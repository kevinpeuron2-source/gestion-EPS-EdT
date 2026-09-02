const SUMMARY = "3EME 1 - EPS";
const DESCRIPTION = "Matière : EPS\\nClasse : 3EME 1\\nProf. : Dupont";
const rawDescParts = (DESCRIPTION || '').split(/\\n/);
let className = "";

for (const part of rawDescParts) {
   if (part.toLowerCase().startsWith('classe')) {
      className = part.split(':')[1]?.trim() || '';
      break;
   }
}
if (!className) {
    const parts = SUMMARY.split('-').map(p => p.trim());
    className = parts.find(p => /[0-9]/.test(p)) || parts[0];
}
console.log(className);
