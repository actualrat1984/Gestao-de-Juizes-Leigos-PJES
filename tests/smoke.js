const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = vm.createContext({});
for (const file of ['src/Config.gs', 'src/Data.gs']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const call = expression => vm.runInContext(expression, context);

context.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: name => name === 'ALLOWED_EMAILS'
      ? 'primeiro@tjes.jus.br; SEGUNDO@TJES.JUS.BR'
      : ''
  })
};
context.Session = {
  getActiveUser: () => ({ getEmail: () => 'primeiro@tjes.jus.br' })
};
vm.runInContext(fs.readFileSync('src/Auth.gs', 'utf8'), context, { filename: 'src/Auth.gs' });

assert.strictEqual(call('JSON.stringify(emailsPermitidos_())'), '["primeiro@tjes.jus.br","segundo@tjes.jus.br"]');
assert.strictEqual(call('identidadeWorkspace_().email'), 'primeiro@tjes.jus.br');
context.Session.getActiveUser = () => ({ getEmail: () => 'naoautorizado@tjes.jus.br' });
assert.throws(() => call('identidadeWorkspace_()'), /não está autorizada/);
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

const styles = fs.readFileSync('src/Styles.html', 'utf8');
assert.match(styles, /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/, 'Elementos com hidden não podem permanecer visíveis');

console.log('Smoke tests passed.');
