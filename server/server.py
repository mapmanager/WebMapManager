import requests
from flask import Flask, make_response, request, send_from_directory
import os
import numpy as np
import brotli
import lerc
import asyncio
import aiohttp

app = Flask(__name__)

@app.route('/api/data/<path:filename>')
def frame(filename):
    return send_from_directory(os.getcwd() + "/data/", path=filename, as_attachment=False)

# Experiment with server side max projection
@app.route('/api/z-slide/')
async def z_slide():
  url = request.args.get('url');
  low = int(request.args.get('low', 0));
  high = int(request.args.get('high'));
  async with aiohttp.ClientSession() as session:
      requests = [getWithZ(session, url, z) for z in range(low, high)];
      data = await asyncio.gather(*requests);
  data = compress(np.max(data, axis=0));

  response = make_response(data)
  response.headers.set('Content-Type', 'application/octet-stream')
  response.headers.set('Content-Encoding', 'br')
  return response


async def getWithZ(session, path, z):
  response = await session.get(path + "z" + str(z) + ".lerc.br");
  response.raise_for_status()
  return decompress(await response.content.read());

def compress(image, quality=5):
    (_, _, lercBlob) = lerc.encode_4D(image, 1, image >= 0, 0, 1)
    return brotli.compress(lercBlob, quality=quality)

def decompress(image, brotli=False):
    if brotli:
        image = brotli.decompress(image)
    (_, array, _, _) = lerc.decode_4D(image)
    return array;
    
if __name__ == '__main__':
    app.run(port=5003, host="0.0.0.0", debug=False)