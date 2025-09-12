# Local Development Setup for MapManagerCore

Configure WebMapManager to use the `cudmore-dev` branch from local MapManagerCore repository.

## Prerequisites
- Local MapManagerCore repo at `../MapManagerCore`
- `cudmore-dev` branch exists in MapManagerCore

## Setup Steps

### Step 1: Create Worktree
```bash
# From WebMapManager directory
cd ../MapManagerCore
git worktree add ../WebMapManager/packages/core/MapManagerCore-worktree cudmore-dev
cd ../WebMapManager
```

### Step 2: Configure Submodule
```bash
# Update submodule to use worktree
git config submodule.packages/core/MapManagerCore.url ./MapManagerCore-worktree

# Sync and update submodule
git submodule sync
git submodule update
```

### Step 3: Verify Setup
```bash
# Check worktree branch
cd packages/core/MapManagerCore-worktree
git branch
# Should show: * cudmore-dev

# Check submodule status
cd ../..
git submodule status
```

### Step 4: Test Build
```bash
# Start development server
yarn dev
```

## Development Workflow

### Making Changes
1. Edit `.py` files in `packages/core/MapManagerCore-worktree/mapmanagercore/`
2. Save files
3. Nodemon automatically rebuilds wheel
4. Refresh browser to see changes

### Saving Progress
```bash
cd packages/core/MapManagerCore-worktree
git add .
git commit -m "Your changes"
git push origin cudmore-dev
```

## Switch Back to Production

```bash
# Remove worktree
cd ../MapManagerCore
git worktree remove ../WebMapManager/packages/core/MapManagerCore-worktree

# Switch to remote
cd ../WebMapManager
git config submodule.packages/core/MapManagerCore.url https://github.com/mapmanager/MapManagerCore.git
git submodule sync
git submodule update --remote
```

## Cleanup
```bash
# Remove worktree when done
cd ../MapManagerCore
git worktree remove ../WebMapManager/packages/core/MapManagerCore-worktree
```
