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

rm -rf ./py/* || true

# TODO: Consider Pulling bioio and embed it!
# TODO: Consider adding another

python -m build --wheel --sdist ./MapManagerCore/ --outdir ./py/

WHEEL_FILE=$(basename ./py/*.whl)
echo -e "/* Generated file */ \nimport pyWheelPath from \"../py/$WHEEL_FILE\";\nexport {pyWheelPath};" > ./src/wheel_info.js

rm -rf ./py/*.tar.gz