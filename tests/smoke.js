const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = vm.createContext({});
for (const file of ['src/Config.gs', 'src/Data.gs']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const call = expression => vm.runInContext(expression, context);
assert.strictEqual(call("textoCelulaSeguro_('texto comum')"), 'texto comum');
assert.strictEqual(call("textoCelulaSeguro_('=IMPORTXML(\"x\")')"), "'=IMPORTXML(\"x\")");
assert.strictEqual(call("statusNormalizado_('')"), 'Pendente');

const headers = call('JL_CONFIG.HEADERS');
const map = {};
Object.values(headers).forEach((header, index) => { map[header] = index; });
context.__map = map;
context.__row = Array(Object.keys(headers).length).fill('');
context.__row[map[headers.FUNCTION]] = 'Juíza Leiga ou Juiz Leigo';
assert.strictEqual(call('ehJuizLeigo_(__row, __map)'), true);
context.__row[map[headers.FUNCTION]] = 'Assessora ou Assessor';
assert.strictEqual(call('ehSolicitacao_(__row, __map)'), true);

console.log('Smoke tests passed.');
