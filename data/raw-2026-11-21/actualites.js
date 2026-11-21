// Bannière « Actualités » : bande fixe en bas de page, fermée par défaut.
// Seule source des entrées : la liste ACTU ci-dessous, la plus récente en tête.
// Une entrée nouvelle rouvre la bande chez qui l'avait masquée.
(function () {
  var ACTU = [
    { date: '20 novembre', media: 'L’instant Christine Kelly', titre: 'Moïse Mitterrand, le podcast', lien: 'videos.html#video-instant-christine-kelly-20-novembre' },
    { date: '19 novembre', media: 'Civilisation', titre: '« Le coût d’État permanent », sur le livre', lien: 'livre.html#on-en-parle' },
    { date: '19 novembre', media: 'France 5 · C ce soir', titre: 'Ingrid Barrat sur les subventions aux associations', lien: 'videos.html#video-france5-c-ce-soir-19-novembre' },
    { date: '10 novembre', media: 'Sénat', titre: 'Ingrid Barrat devant la Délégation à la prospective', lien: 'videos.html#video-senat-prospective-10-novembre' },
    { date: '7 novembre', media: 'BFM Business · La librairie de l’éco', titre: 'Ingrid Barrat présente le livre', lien: 'videos.html#video-bfm-librairie-eco-7-novembre' },
    { date: '6 novembre', media: 'Dossier', titre: 'Coin marginal : sur 100 € gagnés, combien en poche ?', lien: 'coin-marginal.html' }
  ];
  if (!ACTU.length || document.getElementById('actu')) return;
  var cle = 'actu-masquee', derniere = ACTU[0].date + ACTU[0].titre;
  function lire() { try { return localStorage.getItem(cle); } catch (e) { return null; } }
  function ecrire(v) { try { localStorage.setItem(cle, v); } catch (e) {} }
  if (lire() === derniere) return;

  var css = document.createElement('style');
  css.textContent =
    '#actu{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#1a1a1a;color:#fdfcfa;' +
    'font:400 15px/1.4 "Source Serif 4",Georgia,serif;box-shadow:0 -2px 12px rgba(0,0,0,.18)}' +
    '#actu .actu-barre{display:flex;align-items:center;gap:.8rem;max-width:40rem;margin:0 auto;padding:.6rem 1rem}' +
    '#actu button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}' +
    '#actu .actu-ouvrir{flex:1;min-width:0;display:flex;align-items:center;gap:.7rem;text-align:left}' +
    '#actu .actu-tag{flex:none;font:700 11px/1 Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:.18em;' +
    'text-transform:uppercase;color:#1a1a1a;background:#ffd24a;padding:.35rem .5rem}' +
    '#actu .actu-une{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' +
    '#actu .actu-fl{flex:none;display:inline-block;font-size:13px;transition:transform .2s}' +
    '#actu.ouvert .actu-fl{transform:rotate(180deg)}' +
    '#actu .actu-fermer{flex:none;font-size:22px;line-height:1;opacity:.7}' +
    '#actu .actu-fermer:hover{opacity:1}' +
    '#actu ul{display:none;list-style:none;max-width:40rem;margin:0 auto;padding:.2rem 1rem .9rem}' +
    '#actu.ouvert ul{display:block}' +
    '#actu li{padding:.55rem 0;border-top:1px solid #3a3835}' +
    '#actu li a{color:#fdfcfa;text-decoration:none;display:block}' +
    '#actu li a:hover .actu-t{text-decoration:underline}' +
    '#actu .actu-m{display:block;font:700 10.5px/1.3 Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:.14em;' +
    'text-transform:uppercase;color:#ffd24a;margin-bottom:.15rem}' +
    '#actu .actu-t{font-weight:600}' +
    '#actu button:focus-visible,#actu a:focus-visible{outline:2px solid #ffd24a;outline-offset:3px}';
  document.head.appendChild(css);

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  var b = document.createElement('aside');
  b.id = 'actu';
  b.setAttribute('aria-label', 'Actualités');
  b.innerHTML =
    '<div class=actu-barre><button class=actu-ouvrir type=button aria-expanded=false aria-controls=actu-liste>' +
    '<span class=actu-tag>Actualités</span><span class=actu-une>' + esc(ACTU[0].media) + ' — ' + esc(ACTU[0].titre) +
    '</span><span class=actu-fl aria-hidden=true>▲</span></button>' +
    '<button class=actu-fermer type=button aria-label="Masquer les actualités">×</button></div>' +
    '<ul id=actu-liste>' + ACTU.map(function (a) {
      return '<li><a href="' + a.lien + '"><span class=actu-m>' + esc(a.date) + ' · ' + esc(a.media) +
        '</span><span class=actu-t>' + esc(a.titre) + '</span> →</a></li>';
    }).join('') + '</ul>';
  document.body.appendChild(b);

  var ouvrir = b.querySelector('.actu-ouvrir');
  function caler() { document.body.style.paddingBottom = b.offsetHeight + 'px'; }
  ouvrir.addEventListener('click', function () {
    var o = b.classList.toggle('ouvert');
    ouvrir.setAttribute('aria-expanded', o ? 'true' : 'false');
  });
  b.querySelector('.actu-fermer').addEventListener('click', function () {
    ecrire(derniere); b.remove(); document.body.style.paddingBottom = '';
  });
  caler();
})();
