#!/bin/bash

set -e

export PYODIDE=1

if [ ! -d "venv" ]; then
  python3 -m venv venv
  source venv/bin/activate
  pip install --upgrade pip
  pip install build
else
  source venv/bin/activate
fi

rm -rf ./public/py/* || true

python -m build --wheel --sdist ./MapManagerCore/ --outdir ./public/py/

WHEEL_FILE=$(basename ./public/py/*.whl)
echo "{\"fileName\": \"$WHEEL_FILE\"}" > ./src/wheel_info.json

rm -rf ./public/py/*.tar.gz