# WebMapManager Installation Recipe

Complete setup from fresh clone to running `yarn dev`.

## Prerequisites
- Node.js (download from [nodejs.org](https://nodejs.org/en))
- Python 3.11+
- Git

## Installation Steps

### Step 1: Initialize Git Submodules
```bash
# Download MapManagerCore Python package
git submodule init
# Submodule 'src/MapManagerCore' (https://github.com/mapmanager/MapManagerCore.git) registered for path 'packages/core/MapManagerCore'

git submodule update
# Cloning into '/Users/cudmore/Sites/WebMapManager/packages/core/MapManagerCore'...
# Submodule path 'packages/core/MapManagerCore': checked out 'c1c49abb7a8f6568b658aea37e8526103c5cd6a8'
```

### Step 2: Install Yarn
```bash
# Install Yarn package manager
npm install -g yarn
```

### Step 3: Install Node Dependencies
```bash
# Install all JavaScript/TypeScript dependencies
yarn install
```

### Step 4: Install Python Dependencies
```bash
# Install Python packages required for MapManagerCore
pip install -r packages/core/MapManagerCore/requirements.txt
# ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behaviour is the source of the following dependency conflicts.

# bioio 1.1.1.dev9+gabbab2c requires numpy<2.0.0,>=1.21.0, but you have numpy 2.2.6 which is incompatible.

```

### Step 5: Start Development Server
```bash
# Run the development server
yarn dev
```

### Step 6: Open in Browser
Open [http://localhost:3001](http://localhost:3001) in your browser (tested on Google Chrome).

## What Happens During Setup

1. **Git submodules**: Downloads MapManagerCore Python source code
2. **Yarn install**: Installs React, TypeScript, and all web dependencies
3. **Python deps**: Installs build tools for creating Python wheels
4. **yarn dev**: Builds Python wheel and starts web server with hot reload

## Troubleshooting

- **Port 3001 in use**: Check if another process is using the port
- **Python build fails**: Ensure Python 3.11+ is installed and in PATH
- **Submodule issues**: Run `git submodule update --init --recursive`

## Next Steps

After successful installation, see `local-dev-setup.md` for configuring local MapManagerCore development.
