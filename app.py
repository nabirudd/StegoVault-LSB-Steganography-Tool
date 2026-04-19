from flask import Flask, render_template, request, jsonify, send_file
import io, os, base64
from PIL import Image
import steg

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024   # 16 MB upload limit

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/info', methods=['POST'])
def image_info():
    f = request.files.get('image')
    if not f:
        return jsonify({'ok': False, 'message': 'No image provided'}), 400
    try:
        raw = f.read()
        img = Image.open(io.BytesIO(raw)).convert('RGB')
        w, h = img.size
        cap = steg.capacity(raw)
        b64 = base64.b64encode(raw).decode()
        return jsonify({'ok': True, 'width': w, 'height': h,
                        'capacity': cap, 'preview': f'data:image/png;base64,{b64}'})
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 400

@app.route('/api/encode', methods=['POST'])
def encode():
    f          = request.files.get('image')
    message    = request.form.get('message', '').strip()
    passphrase = request.form.get('passphrase', '').strip()

    if not f:
        return jsonify({'ok': False, 'message': 'No image provided'}), 400
    if not message:
        return jsonify({'ok': False, 'message': 'Message cannot be empty'}), 400

    try:
        raw    = f.read()
        result = steg.encode(raw, message, passphrase)
        b64    = base64.b64encode(result).decode()
        return jsonify({'ok': True, 'image': f'data:image/png;base64,{b64}',
                        'size': len(result), 'encrypted': bool(passphrase)})
    except ValueError as e:
        return jsonify({'ok': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'ok': False, 'message': f'Encoding failed: {e}'}), 500

@app.route('/api/decode', methods=['POST'])
def decode():
    f          = request.files.get('image')
    passphrase = request.form.get('passphrase', '').strip()

    if not f:
        return jsonify({'ok': False, 'message': 'No image provided'}), 400

    try:
        raw     = f.read()
        message = steg.decode(raw, passphrase)
        return jsonify({'ok': True, 'message': message, 'length': len(message)})
    except ValueError as e:
        return jsonify({'ok': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'ok': False, 'message': f'Decoding failed: {e}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5002)
