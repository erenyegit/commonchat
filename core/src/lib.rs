use chacha20poly1305::{aead::Aead, AeadCore, ChaCha20Poly1305, KeyInit};
use commonware_codec::{FixedSize, Read, Write};
use commonware_cryptography::ed25519;
use commonware_cryptography::Signer;
use commonware_cryptography::Verifier;
use commonware_math::algebra::Random;
use curve25519_dalek::edwards::CompressedEdwardsY;
use hex;
use hkdf::Hkdf;
use sha2::{Digest, Sha256, Sha512};
use wasm_bindgen::prelude::*;
use x25519_dalek::{PublicKey as X25519PublicKey, StaticSecret};

const CHAT_NAMESPACE: &[u8] = b"commonchat.v1";

/// Identity: Ed25519 public key + private key (for signing).
#[wasm_bindgen]
pub struct CommonwareIdentity {
    private_key: ed25519::PrivateKey,
    pub_key_hex: String,
}

#[wasm_bindgen]
impl CommonwareIdentity {
    #[wasm_bindgen(getter)]
    pub fn pub_key(&self) -> String {
        self.pub_key_hex.clone()
    }

    /// Signs the message with Ed25519; returns the signature as a hex string.
    #[wasm_bindgen]
    pub fn sign(&self, message: &str) -> String {
        let sig = self.private_key.sign(CHAT_NAMESPACE, message.as_bytes());
        hex::encode(sig.as_ref())
    }

    /// Exports the private key as a hex string (for localStorage).
    #[wasm_bindgen]
    pub fn export_private_hex(&self) -> String {
        hex::encode(self.ed25519_seed_bytes())
    }

    #[wasm_bindgen]
    pub fn get_x25519_public_key(&self) -> String {
        let seed = self.ed25519_seed_bytes();

        // SHA-512(seed) → 64 bytes, take first 32
        let hash = Sha512::digest(&seed);
        let mut x25519_input = [0u8; 32];
        x25519_input.copy_from_slice(&hash[..32]);

        // StaticSecret::from() clamps the scalar internally
        let secret = StaticSecret::from(x25519_input);
        let public = X25519PublicKey::from(&secret);

        hex::encode(public.as_bytes())
    }

    #[wasm_bindgen]
    pub fn encrypt_for_peer(
        &self,
        recipient_x25519_pub_hex: &str,
        plaintext: &str,
    ) -> Result<String, JsError> {
        // Decode recipient's X25519 public key from hex
        let recip_bytes = hex::decode(recipient_x25519_pub_hex)
            .map_err(|e| JsError::new(&format!("invalid recipient pub hex: {}", e)))?;
        if recip_bytes.len() != 32 {
            return Err(JsError::new("recipient X25519 pub key must be 32 bytes"));
        }
        let mut recip_arr = [0u8; 32];
        recip_arr.copy_from_slice(&recip_bytes);
        let recip_pub = X25519PublicKey::from(recip_arr);

        // Derive our X25519 secret from Ed25519 seed
        let hash = Sha512::digest(&self.ed25519_seed_bytes());
        let mut x_input = [0u8; 32];
        x_input.copy_from_slice(&hash[..32]);
        let my_secret = StaticSecret::from(x_input);

        // ECDH → shared secret
        let shared = my_secret.diffie_hellman(&recip_pub);

        // HKDF-SHA256 → encryption key
        let hk = Hkdf::<Sha256>::new(None, shared.as_bytes());
        let mut enc_key = [0u8; 32];
        hk.expand(b"commonchat.e2e.v1", &mut enc_key)
            .map_err(|_| JsError::new("HKDF expand failed"))?;

        // ChaCha20-Poly1305 encrypt
        let cipher = ChaCha20Poly1305::new((&enc_key).into());
        let nonce = ChaCha20Poly1305::generate_nonce(&mut rand::thread_rng());
        let ciphertext = cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|_| JsError::new("encryption failed"))?;

        // Return hex(nonce ‖ ciphertext)
        let mut combined = Vec::with_capacity(12 + ciphertext.len());
        combined.extend_from_slice(&nonce);
        combined.extend_from_slice(&ciphertext);
        Ok(hex::encode(combined))
    }

    #[wasm_bindgen]
    pub fn decrypt_from_peer(
        &self,
        sender_x25519_pub_hex: &str,
        encrypted_hex: &str,
    ) -> Result<String, JsError> {
        // Decode the combined nonce+ciphertext
        let combined = hex::decode(encrypted_hex)
            .map_err(|e| JsError::new(&format!("invalid encrypted hex: {}", e)))?;
        if combined.len() < 12 + 16 {
            // 12-byte nonce + at least 16-byte Poly1305 tag
            return Err(JsError::new("ciphertext too short"));
        }
        let (nonce_bytes, ciphertext) = combined.split_at(12);

        // Decode sender's X25519 public key
        let sender_bytes = hex::decode(sender_x25519_pub_hex)
            .map_err(|e| JsError::new(&format!("invalid sender pub hex: {}", e)))?;
        if sender_bytes.len() != 32 {
            return Err(JsError::new("sender X25519 pub key must be 32 bytes"));
        }
        let mut sender_arr = [0u8; 32];
        sender_arr.copy_from_slice(&sender_bytes);
        let sender_pub = X25519PublicKey::from(sender_arr);

        // Derive our X25519 secret (same as encrypt)
        let hash = Sha512::digest(&self.ed25519_seed_bytes());
        let mut x_input = [0u8; 32];
        x_input.copy_from_slice(&hash[..32]);
        let my_secret = StaticSecret::from(x_input);

        // ECDH → same shared secret
        let shared = my_secret.diffie_hellman(&sender_pub);

        // HKDF → same encryption key
        let hk = Hkdf::<Sha256>::new(None, shared.as_bytes());
        let mut enc_key = [0u8; 32];
        hk.expand(b"commonchat.e2e.v1", &mut enc_key)
            .map_err(|_| JsError::new("HKDF expand failed"))?;

        // Decrypt
        let cipher = ChaCha20Poly1305::new((&enc_key).into());
        let plaintext = cipher
            .decrypt(nonce_bytes.into(), ciphertext)
            .map_err(|_| JsError::new("decryption failed (wrong key or tampered)"))?;

        String::from_utf8(plaintext).map_err(|_| JsError::new("decrypted data is not valid UTF-8"))
    }

    fn ed25519_seed_bytes(&self) -> [u8; 32] {
        let mut buf = bytes::BytesMut::new();
        Write::write(&self.private_key, &mut buf);
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&buf);
        seed
    }
}

/// Creates a new random identity.
#[wasm_bindgen]
pub fn create_identity() -> CommonwareIdentity {
    let private_key = ed25519::PrivateKey::random(&mut rand::thread_rng());
    let public_key = private_key.public_key();
    CommonwareIdentity {
        pub_key_hex: hex::encode(public_key.as_ref()),
        private_key,
    }
}

/// Verifies the signature: is signature_hex valid for message under pub_key_hex?
#[wasm_bindgen]
pub fn verify_signature(
    pub_key_hex: &str,
    message: &str,
    signature_hex: &str,
) -> Result<bool, JsError> {
    let pub_bytes = hex::decode(pub_key_hex)
        .map_err(|e| JsError::new(&format!("invalid pub key hex: {}", e)))?;
    if pub_bytes.len() != ed25519::PublicKey::SIZE {
        return Err(JsError::new("invalid pub key length"));
    }
    let sig_bytes =
        hex::decode(signature_hex).map_err(|e| JsError::new(&format!("invalid sig hex: {}", e)))?;
    if sig_bytes.len() != ed25519::Signature::SIZE {
        return Err(JsError::new("invalid signature length"));
    }
    let mut pub_buf = bytes::Bytes::from(pub_bytes);
    let mut sig_buf = bytes::Bytes::from(sig_bytes);
    let public_key = ed25519::PublicKey::read_cfg(&mut pub_buf, &())
        .map_err(|e| JsError::new(&format!("decode pub key: {:?}", e)))?;
    let signature = ed25519::Signature::read_cfg(&mut sig_buf, &())
        .map_err(|e| JsError::new(&format!("decode signature: {:?}", e)))?;
    Ok(public_key.verify(CHAT_NAMESPACE, message.as_bytes(), &signature))
}

/// Converts any Ed25519 public key to its X25519 equivalent (Edwards → Montgomery).
#[wasm_bindgen]
pub fn ed25519_pub_to_x25519_pub(ed25519_pub_hex: &str) -> Result<String, JsError> {
    let pub_bytes =
        hex::decode(ed25519_pub_hex).map_err(|e| JsError::new(&format!("invalid hex: {}", e)))?;
    if pub_bytes.len() != 32 {
        return Err(JsError::new("ed25519 public key must be 32 bytes"));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&pub_bytes);

    // Decompress the Edwards point, then convert to Montgomery form
    let edwards = CompressedEdwardsY(arr);
    let point = edwards
        .decompress()
        .ok_or_else(|| JsError::new("invalid Ed25519 public key point"))?;
    let montgomery = point.to_montgomery();

    Ok(hex::encode(montgomery.to_bytes()))
}

/// Restores identity from private key hex (e.g. read from localStorage).
#[wasm_bindgen]
pub fn identity_from_private_hex(hex_str: &str) -> Result<CommonwareIdentity, JsError> {
    let bytes_vec =
        hex::decode(hex_str).map_err(|e| JsError::new(&format!("invalid hex: {}", e)))?;
    if bytes_vec.len() != ed25519::PrivateKey::SIZE {
        return Err(JsError::new("invalid key length"));
    }
    let mut buf = bytes::Bytes::from(bytes_vec);
    let private_key = ed25519::PrivateKey::read_cfg(&mut buf, &())
        .map_err(|e| JsError::new(&format!("decode key: {:?}", e)))?;
    let pub_key_hex = hex::encode(private_key.public_key().as_ref());
    Ok(CommonwareIdentity {
        private_key,
        pub_key_hex,
    })
}
