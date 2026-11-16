import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext, runInContext } from 'node:vm';

const copies = ['src/footer.js', 'site/index.html',
  'backups/before-typography/footer.js', 'backups/before-typography/index.html'];
const owner = { published: true, token: 'owner-token-not-a-real-secret', key: 'owner-key-not-a-real-secret' };
const guestData = { name1: 'Guest', name2: 'Invitation', date: '2027-01-01',
  time: '12:00', content: 0, theme: 0, motion: true, personal: {} };
const origin = 'https://dearly.test';
const legacyHash = data => '#invite=' + Buffer.from(JSON.stringify(data)).toString('base64url');
const ownerURL = origin + '/#card=' + owner.token + '.' + owner.key;

// Load the actual entrypoint, renderer and sharing functions from every shipped copy.
// DOM, IndexedDB and timers are controlled substitutes; there is no network access.
function harness(source, reduced = false) {
  function fn(name) {
    const lines = source.split('\n');
    const constant = lines.find(line => line.startsWith('const ' + name + '='));
    if (constant) return constant;
    const i = lines.findIndex(line => new RegExp('^(?:async )?function ' + name + '\\(').test(line));
    assert.notEqual(i, -1, 'missing actual source function ' + name);
    if (lines[i].trimEnd().endsWith('{')) {
      const end = lines.findIndex((line, n) => n > i && line === '}');
      return lines.slice(i, end + 1).join('\n');
    }
    return lines[i].slice(0, lines[i].lastIndexOf('}') + 1);
  }
  const context = createContext({
    TextEncoder, TextDecoder, URLSearchParams,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    location: { origin, pathname: '/', hash: '' },
    cloud: {}, current: null, guest: false, dirty: false, restoreVersion: 0,
    theme: 0, templates: Array.from({ length: 50 }, () => ({ name: 'template' })),
    fields: ['name1', 'name2', 'date', 'time', 'venue', 'address', 'message'],
    cleanTypeface: () => 'serif',
    matchMedia: () => ({ matches: reduced }),
    timers: [], copied: [], status: {}, full: {
      innerHTML: '', contains() { return this.innerHTML.includes('id="ow-open"'); },
    }, selected: {},
    setTimeout(callback) { context.timers.push(callback); },
    navigator: { clipboard: { async writeText(url) { context.copied.push(url); } } },
    window: {}, saved: null,
    populate() {}, displayName: t => t.name, drawLibrary() {}, syncPhotoUI() {}, studioNotice() {},
  });
  runInContext(`
    const opener = { disabled:false, parentElement:{classList:{add(){}}},
      addEventListener(type, callback){ this.click=callback; } };
    const document = { getElementById(id) {
      return id==='ow-open' ? (full.innerHTML.includes('id="ow-open"') ? opener : null) : selected;
    }};
    const dialog = { open:false, showModal(){this.open=true;},
      close(){this.open=false;if(guest){location.hash='';guest=false;}} };
    async function draftDB() {
      return {close(){},transaction(){return {objectStore(){return {get(){
        const request={result:saved};
        Promise.resolve().then(()=>request.onsuccess());
        return request;
      }}}}}};
    }
  `, context);

  for (const name of ['esc','clamp','cleanPersonal','shareURL','normalized','encode','decode',
    'invitationShareClick','invitationExtras','restoreDraft','show','shared']) {
    runInContext(fn(name), context);
  }
  runInContext('function markup(d){ return invitationExtras(d, ""); }', context);
  return {
    context,
    visit(data) { context.location.hash = legacyHash(data); context.shared(); },
    async restore() { context.saved = { cloud: { ...owner }, data: guestData }; await context.restoreDraft(); },
    open() { runInContext('opener.click()', context); },
    close() { runInContext('dialog.close()', context); },
    flush() { while (context.timers.length) context.timers.shift()(); },
    urls() { return [...context.full.innerHTML.matchAll(/data-share-url="([^"]*)"/g)].map(m => m[1]); },
    async copy() {
      const [url] = this.urls();
      await context.invitationShareClick({
        dataset: { shareUrl: url, shareKind: 'copy', shareTitle: 'Guest' },
        closest: () => ({ querySelector: () => ({}) }),
      });
      return context.copied.at(-1);
    },
  };
}
for (const path of copies) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  test(path + ': JavaScript syntax', () => {
    const scripts = path.endsWith('.js') ? [source] :
      [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
        .filter(m => !/\bsrc\s*=/.test(m[1]) && !/type=["']application\/(?:ld\+)?json/.test(m[1]))
        .map(m => m[2]).filter(s => s.trim());
    assert.ok(scripts.length);
    for (const script of scripts) new Script(script);
  });
  test(path + ': restored publisher cannot replace delayed guest sharing URL', async () => {
    const h = harness(source);
    h.visit(guestData);
    await h.restore();
    h.open(); h.flush();
    assert.deepEqual(h.urls(), Array(2).fill(origin + '/' + legacyHash(guestData)));
    assert.equal(await h.copy(), origin + '/' + legacyHash(guestData));
    assert.ok(!h.context.full.innerHTML.includes(owner.key));
  });
  for (const reduced of [false, true]) {
    test(path + ': existing owner session, immediate guest render, reduced=' + reduced, () => {
      const h = harness(source, reduced);
      h.context.cloud = { ...owner };
      const d = { ...guestData, motion: reduced };
      h.visit(d);
      assert.deepEqual(h.urls(), Array(2).fill(origin + '/' + legacyHash(d)));
    });
  }
  test(path + ': captured guest URL survives a hash change during animation', () => {
    const h = harness(source);
    h.context.cloud = { ...owner };
    h.visit(guestData);
    h.open();
    h.context.location.hash = '#studio';
    h.flush();
    assert.deepEqual(h.urls(), Array(2).fill(origin + '/' + legacyHash(guestData)));
  });
  test(path + ': closing during animation prevents a late render', () => {
    const h = harness(source);
    h.context.cloud = { ...owner };
    h.visit(guestData);
    h.open(); h.close(); h.flush();
    assert.deepEqual(h.urls(), []);
  });
  test(path + ': pending owner animation cannot overwrite a newer guest invitation', () => {
    const h = harness(source);
    h.context.cloud = { ...owner };
    h.context.show({ ...guestData, name1: 'Owner' }, false);
    h.open();
    const d = { ...guestData, motion: false };
    h.visit(d);
    h.flush();
    assert.deepEqual(h.urls(), Array(2).fill(origin + '/' + legacyHash(d)));
    assert.ok(!h.context.full.innerHTML.includes(owner.key));
  });
  test(path + ': pending guest animation cannot overwrite another guest invitation', () => {
    const h = harness(source);
    h.visit(guestData); h.open();
    const d = { ...guestData, name1: 'Next guest', motion: false };
    h.visit(d); h.flush();
    assert.deepEqual(h.urls(), Array(2).fill(origin + '/' + legacyHash(d)));
  });
  test(path + ': a removed envelope cannot overwrite a public viewer loading state', () => {
    const h = harness(source);
    h.context.cloud = { ...owner };
    h.context.show({ ...guestData, name1: 'Owner' }, false); h.open();
    h.context.full.innerHTML = '<p>Loading public invitation</p>';
    h.flush();
    assert.equal(h.context.full.innerHTML, '<p>Loading public invitation</p>');
  });
  test(path + ': replacement dialog and forged sharing fields keep received URL', () => {
    const h = harness(source);
    h.context.cloud = { ...owner };
    h.visit({ ...guestData, motion: false });
    const d = { ...guestData, motion: false, shareUrl: ownerURL, owner: true };
    h.visit(d);
    assert.deepEqual(h.urls(), Array(2).fill(origin + '/' + legacyHash(d)));
    assert.ok(!h.context.full.innerHTML.includes(owner.key));
  });
  test(path + ': modern guest link retains explicit URL', () => {
    const h = harness(source);
    h.context.cloud = { ...owner };
    const d = { ...guestData, motion: false, shareUrl: origin + '/#card=guest-token.guest-key' };
    h.context.show(d, true);
    assert.deepEqual(h.urls(), Array(2).fill(d.shareUrl));
  });
  test(path + ': owner preview/export and first publish retain owner link', () => {
    const h = harness(source);
    const d = { ...guestData, motion: false };
    assert.equal(h.context.shareURL(d), '');
    h.context.cloud = { ...owner };
    assert.equal(h.context.shareURL(d), ownerURL);
    h.context.show(d, false);
    assert.deepEqual(h.urls(), Array(2).fill(ownerURL));
    assert.ok(h.context.invitationExtras(d, '').includes('data-share-url="' + ownerURL + '"'));
  });
  test(path + ': unpublished photo remains unshareable; text invitation still shares', () => {
    const h = harness(source);
    assert.ok(h.context.invitationExtras({ ...guestData, personal: { photo:'data:image/jpeg;base64,AA==' } }, '')
      .includes('data-share-url=""'));
    assert.ok(h.context.invitationExtras(guestData, '').includes(origin + '/#invite='));
  });
}

