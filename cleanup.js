const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if(file !== 'node_modules' && file !== '.next') filelist = walkSync(filePath, filelist);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      filelist.push(filePath);
    }
  });
  return filelist;
};

const files = [
  ...walkSync(path.join(process.cwd(), 'app'))
];

let count = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Regex to find profile?.rol === 'ADMIN', profile.rol !== 'AGENTE', user_metadata?.rol === 'AGENTE'
  // Also msg.profiles?.rol === 'AGENTE'
  const regex = /(profile\.rol|profile\?\.rol|user_metadata\?\.rol|msg\.profiles\?\.rol)\s*(===|!==)\s*(['"][A-Z]+['"])/g;
  const newContent = content.replace(regex, (match, param1, param2, param3) => {
    return param1 + '?.toUpperCase() ' + param2 + ' ' + param3;
  });
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    count++;
    console.log('Updated ' + file);
  }
}
console.log('Total files updated: ' + count);
