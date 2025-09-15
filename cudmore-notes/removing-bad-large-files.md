# Removing Large Files from Git - Quick Recovery Recipe

## 🚨 **The Problem**
Accidentally added a large file (e.g., .tif, .whl) with `git add` and now GitHub rejects pushes due to file size limits.

## ⚡ **Quick Fix (5 minutes)**

### **Step 1: Remove from git tracking**
```bash
git rm --cached path/to/large-file.tif
```

### **Step 2: Add to .gitignore**
```bash
echo "*.tif" >> .gitignore
echo "*.whl" >> .gitignore
```

### **Step 3: Commit the removal**
```bash
git add .gitignore
git commit -m "Remove large file and add to .gitignore"
```

### **Step 4: Force push (if you're the only one on the branch)**
```bash
git push --force-with-lease origin your-branch-name
```

## 🛡️ **Prevention (Do this once)**

### **Add to .gitignore**
```bash
# Add these lines to .gitignore
*.tif
*.tiff
*.whl
packages/core/src/__tests__/migrate-cudmore-dev/fixtures/*.tif
```

### **Pre-commit hook (prevents future mistakes)**
```bash
# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
large_files=$(git diff --cached --name-only | xargs -I {} sh -c 'if [ -f "{}" ]; then size=$(stat -f%z "{}" 2>/dev/null || stat -c%s "{}" 2>/dev/null); if [ "$size" -gt 104857600 ]; then echo "{}"; fi; fi')
if [ ! -z "$large_files" ]; then
    echo "Error: Large files detected (>100MB):"
    echo "$large_files"
    echo "Use Git LFS or add to .gitignore"
    exit 1
fi
EOF

chmod +x .git/hooks/pre-commit
```

## 🔄 **If the simple fix doesn't work**

### **Reset to clean remote**
```bash
# If you have divergent branches
git fetch origin
git reset --hard origin/your-branch-name
```

### **Clean merge from another branch**
```bash
# If the large file came from a merge
git checkout clean-branch
git merge your-branch-name
```

## 📋 **Checklist**
- [ ] File removed from git tracking
- [ ] Added to .gitignore
- [ ] Committed the changes
- [ ] Push succeeds without file size errors

## ⚠️ **What NOT to do**
- Don't use `git reset --hard` without backup
- Don't use `git filter-branch` (too complex)
- Don't try to rewrite history manually

## 🎯 **Key Takeaway**
The 4-step quick fix above should solve 90% of large file problems in under 5 minutes. Only use the complex solutions if the simple fix fails.

---
*Created after spending 2-3 hours on a simple .tif file mistake*
