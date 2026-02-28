const fs = require('fs');
const path = require('path');

function checkFileCase(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            checkFileCase(fullPath);
        } else if (file.isFile() && (fullPath.endsWith('.js') || fullPath.endsWith('.jsx'))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const importRegex = /import.*?['"]([^'"]+)['"]/g;
            const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

            const checkMatches = (regex) => {
                let match;
                while ((match = regex.exec(content)) !== null) {
                    let importPath = match[1];
                    // We only check relative imports
                    if (importPath.startsWith('.')) {
                        // Check if the file exists exactly with that case
                        let resolvedPath = path.resolve(path.dirname(fullPath), importPath);
                        let dirToRead = path.dirname(resolvedPath);
                        let baseToFind = path.basename(resolvedPath);

                        if (fs.existsSync(dirToRead)) {
                            let actualFiles = fs.readdirSync(dirToRead);

                            let exactMatch = actualFiles.find(f => {
                                return f === baseToFind || f === baseToFind + '.js' || f === baseToFind + '.jsx' || f === baseToFind + '.css';
                            });

                            if (!exactMatch) {
                                // Find case insensitive match
                                let caseMismatch = actualFiles.find(f => {
                                    let lowerF = f.toLowerCase();
                                    let lowerB = baseToFind.toLowerCase();
                                    return lowerF === lowerB || lowerF === lowerB + '.js' || lowerF === lowerB + '.jsx' || lowerF === lowerB + '.css';
                                });

                                if (caseMismatch) {
                                    console.log(`CASE MISMATCH in ${fullPath}: imported '${importPath}', but actual file is '${caseMismatch}'`);
                                }
                            }
                        }
                    }
                }
            };

            checkMatches(importRegex);
            checkMatches(requireRegex);
        }
    }
}

checkFileCase(path.join(process.cwd(), 'src'));
console.log('Case check complete.');
