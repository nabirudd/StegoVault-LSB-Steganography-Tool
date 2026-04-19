import struct, io
from PIL import Image
from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
from Crypto.Random import get_random_bytes

SALT_SIZE  = 16
KEY_SIZE   = 32   # AES-256
NONCE_SIZE = 16
TAG_SIZE   = 16

def _derive_key(passphrase: str, salt: bytes) -> bytes:
    return PBKDF2(passphrase.encode(), salt, dkLen=KEY_SIZE, count=100_000)

def _encrypt(data: bytes, passphrase: str) -> bytes:
    salt  = get_random_bytes(SALT_SIZE)
    key   = _derive_key(passphrase, salt)
    cipher = AES.new(key, AES.MODE_GCM)
    ct, tag = cipher.encrypt_and_digest(data)
    return salt + cipher.nonce + tag + ct

def _decrypt(data: bytes, passphrase: str) -> bytes:
    salt   = data[:SALT_SIZE]
    nonce  = data[SALT_SIZE:SALT_SIZE+NONCE_SIZE]
    tag    = data[SALT_SIZE+NONCE_SIZE:SALT_SIZE+NONCE_SIZE+TAG_SIZE]
    ct     = data[SALT_SIZE+NONCE_SIZE+TAG_SIZE:]
    key    = _derive_key(passphrase, salt)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ct, tag)

def capacity(image_bytes: bytes) -> int:
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    w, h = img.size
    return (w * h * 3) // 8 - 5   # usable bytes minus 5-byte header

def encode(image_bytes: bytes, message: str, passphrase: str = '') -> bytes:
    img    = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    pixels = list(img.getdata())

    payload = message.encode('utf-8')
    use_enc = bool(passphrase)
    if use_enc:
        payload = _encrypt(payload, passphrase)

    header = struct.pack('>I', len(payload)) + (b'\x01' if use_enc else b'\x00')
    data   = header + payload
    bits   = ''.join(f'{b:08b}' for b in data)

    max_bits = len(pixels) * 3
    if len(bits) > max_bits:
        raise ValueError(f'Message too large. Max capacity for this image: {(max_bits // 8) - 5} bytes.')

    new_pixels = []
    idx = 0
    for r, g, b in pixels:
        if idx < len(bits): r = (r & ~1) | int(bits[idx]); idx += 1
        if idx < len(bits): g = (g & ~1) | int(bits[idx]); idx += 1
        if idx < len(bits): b = (b & ~1) | int(bits[idx]); idx += 1
        new_pixels.append((r, g, b))

    out = Image.new('RGB', img.size)
    out.putdata(new_pixels)
    buf = io.BytesIO()
    out.save(buf, format='PNG')
    return buf.getvalue()

def decode(image_bytes: bytes, passphrase: str = '') -> str:
    img    = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    pixels = list(img.getdata())

    bits = []
    for r, g, b in pixels:
        bits += [r & 1, g & 1, b & 1]

    def to_bytes(bl):
        return bytes(int(''.join(str(x) for x in bl[i:i+8]), 2)
                     for i in range(0, len(bl) - 7, 8))

    header  = to_bytes(bits[:40])
    length  = struct.unpack('>I', header[:4])[0]
    is_enc  = header[4]

    if length == 0 or length > len(bits) // 8:
        raise ValueError('No hidden message found in this image.')

    payload = to_bytes(bits[40:40 + length * 8])

    if is_enc:
        if not passphrase:
            raise ValueError('Message is encrypted — please supply the passphrase.')
        try:
            payload = _decrypt(payload, passphrase)
        except Exception:
            raise ValueError('Wrong passphrase or corrupted data.')

    return payload.decode('utf-8')
