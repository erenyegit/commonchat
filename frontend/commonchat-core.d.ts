declare module "commonchat-core" {
  export class CommonwareIdentity {
    constructor();
    free(): void;
    export_private_hex(): string;
    sign(message: string): string;
    readonly pub_key: string;
  }
  export function create_identity(): CommonwareIdentity;
  export function identity_from_private_hex(hex_str: string): CommonwareIdentity;
  export function verify_signature(
    pub_key_hex: string,
    message: string,
    signature_hex: string
  ): boolean;
  export default function init(): Promise<unknown>;
}
