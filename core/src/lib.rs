use commonware_codec::{FixedSize, Read, Write};
use commonware_cryptography::ed25519;
use commonware_cryptography::Signer;
use commonware_cryptography::Verifier;
use commonware_math::algebra::Random;
use hex;
use wasm_bindgen::prelude::*;

const CHAT_NAMESPACE: &[u8] = b"commonchat.v1";

/// Kimlik: Ed25519 public key + içeride private key (imza için).
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

    /// Mesajı Ed25519 ile imzalar; imza hex string olarak döner.
    #[wasm_bindgen]
    pub fn sign(&self, message: &str) -> String {
        let sig = self
            .private_key
            .sign(CHAT_NAMESPACE, message.as_bytes());
        hex::encode(sig.as_ref())
    }

    /// Private key'i hex string olarak dışa aktarır (localStorage için).
    #[wasm_bindgen]
    pub fn export_private_hex(&self) -> String {
        let mut buf = bytes::BytesMut::new();
        Write::write(&self.private_key, &mut buf);
        hex::encode(&buf)
    }
}

/// Yeni rastgele kimlik oluşturur.
#[wasm_bindgen]
pub fn create_identity() -> CommonwareIdentity {
    let private_key = ed25519::PrivateKey::random(&mut rand::thread_rng());
    let public_key = private_key.public_key();
    CommonwareIdentity {
        pub_key_hex: hex::encode(public_key.as_ref()),
        private_key,
    }
}

/// İmzayı doğrular: pub_key_hex ile message üzerindeki signature_hex geçerli mi?
#[wasm_bindgen]
pub fn verify_signature(
    pub_key_hex: &str,
    message: &str,
    signature_hex: &str,
) -> Result<bool, JsError> {
    let pub_bytes =
        hex::decode(pub_key_hex).map_err(|e| JsError::new(&format!("invalid pub key hex: {}", e)))?;
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

/// localStorage'tan okunan private key hex ile kimliği geri yükler.
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
