// Lettres de « J'écris à mon élu » : remplissage des champs du modèle,
// commun à la page (ecrire.html) et au relais d'envoi (api/). Les textes
// viennent de lettres/textes.json (outils/lettres.py).
//
// Le contexte d'une lettre : { coord: {nom, adr, cp, mel, tel}, ville,
// dep, mai, arr, sen (fiches de données/elus), fArr (maire d'arrondissement :
// femme ?), etranger (Français de l'étranger ?), date }. Genres de lettre :
// dep, mai, arr (mairie d'arrondissement, sur le modèle du maire), sen (le
// sénateur de ctx.sen).
//
// Le corps de la lettre, de la formule d'appel à la formule de politesse, est
// modifiable : corps = texte, paragraphes séparés par une ligne vide. Sans
// corps, celui du modèle. En-tête et signature restent ceux du modèle.
(function (racine) {
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
    'septembre', 'octobre', 'novembre', 'décembre'];
  var OBJET = 'Redresser la France dès le budget 2027';
  var COPIE = 'contact@france-resolution.fr';
  var CHAMP_APPEL_MAI = '[Madame la Maire / Monsieur le Maire]';

  function dateFr(d) {
    d = d || new Date();
    return (d.getDate() === 1 ? '1er' : d.getDate()) + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function elide(v) { return /^[aeiouyàâéèêîïôû]/i.test(v || ''); }
  function mairieDe(v) { return 'Mairie ' + (elide(v) ? 'd’' : 'de ') + v; }
  function modele(genre) { return genre === 'dep' || genre === 'sen' ? genre : 'mai'; }
  function appel(genre, ctx) {
    if (genre === 'dep') return ctx.dep && ctx.dep.f ? 'Madame la Députée' : 'Monsieur le Député';
    if (genre === 'sen') return ctx.sen && ctx.sen.f ? 'Madame la Sénatrice' : 'Monsieur le Sénateur';
    if (genre === 'arr') return ctx.fArr === true ? 'Madame la Maire' : ctx.fArr === false ? 'Monsieur le Maire' : '';
    return ctx.mai && ctx.mai.f ? 'Madame la Maire' : 'Monsieur le Maire';
  }
  function valeurs(genre, ctx) {
    var c = ctx.coord || {};
    var v = {
      '[Prénom NOM]': c.nom || '', '[Adresse]': c.adr || '', '[Code postal et commune]': c.cp || '',
      '[Courriel]': c.mel || '', '[Téléphone]': c.tel || '', '[commune]': ctx.ville || '',
      '[date]': ctx.date || dateFr(), '[Signature]': ''
    };
    if (genre === 'dep') v['[Madame la Députée / Monsieur le Député]'] = appel(genre, ctx);
    else if (genre === 'sen') v['[Madame la Sénatrice / Monsieur le Sénateur]'] = appel(genre, ctx);
    else {
      var m = genre === 'arr' ? ctx.arr : ctx.mai;
      v[CHAMP_APPEL_MAI] = appel(genre, ctx);
      v['[Adresse de la mairie]'] = m ? m.rue : '';
      v['[Code postal et commune de la mairie]'] = m ? m.cp : '';
    }
    return v;
  }
  // Ligne de destinataire de la mairie : « Mairie d’Issy… », ou l'intitulé
  // de la mairie d'arrondissement.
  function ligneMairie(genre, ctx) {
    return genre === 'arr' && ctx.arr ? ctx.arr.lib : mairieDe(ctx.ville || '');
  }
  function echappe(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Un paragraphe rempli. marque : HTML de l'aperçu, champs surlignés.
  function remplir(t, genre, ctx, marque) {
    var v = valeurs(genre, ctx);
    var m = '<span class=e-var>';
    if (t === 'Mairie de [commune]') return marque ? m + echappe(ligneMairie(genre, ctx)) + '</span>' : ligneMairie(genre, ctx);
    var s = (marque ? echappe(t) : t).replace(/\[[^\]]+\]/g, function (k) {
      if (!(k in v)) return k;
      var x = v[k];
      if (!marque) return x;
      if (x) return m + echappe(x) + '</span>';
      return /^\[(Signature|Téléphone|Courriel)\]$/.test(k) ? '' : '<span class=e-vide>' + echappe(k) + '</span>';
    });
    return s.replace(/^\s*—\s*|\s*—\s*$/g, '');
  }

  // Bornes du corps dans la liste des paragraphes : la formule d'appel qui
  // suit l'objet, la formule de politesse.
  function bornes(t) {
    var o = t.findIndex(function (x) { return /^Objet/.test(x); });
    return [t.findIndex(function (x, k) { return k > o && /^\[Madame/.test(x); }),
            t.findIndex(function (x) { return /^Je vous prie/.test(x); })];
  }
  // Le corps du modèle, rempli : texte modifiable de départ.
  function corpsModele(genre, ctx, textes) {
    var t = textes[modele(genre)].map(function (p) { return p[0]; }), b = bornes(t);
    return t.slice(b[0], b[1] + 1).filter(function (x) { return x.trim(); })
      .map(function (x) { return remplir(x, genre, ctx, false); }).join('\n\n');
  }
  function paragraphes(corps) {
    return String(corps).replace(/\r/g, '').split(/\n\s*\n/).map(function (x) { return x.replace(/\s*\n\s*/g, ' ').trim(); }).filter(Boolean);
  }
  // Le courriel : le corps, puis la signature et les coordonnées.
  function courriel(genre, ctx, textes, corps) {
    var c = ctx.coord || {};
    return paragraphes(corps || corpsModele(genre, ctx, textes)).join('\n\n') + '\n\n'
      + [c.nom, c.adr, c.cp, c.mel, c.tel].filter(Boolean).join('\n');
  }

  // Le Word rempli : chaque champ est remplacé dans son passage de texte, et
  // l'italique des champs à remplir tombe avec eux.
  function remplirXml(xml, genre, ctx, corps) {
    if (corps) xml = remplacerCorps(xml, paragraphes(corps));
    var v = valeurs(genre, ctx);
    var ital = '<w:rPr><w:i/><w:iCs/></w:rPr><w:t xml:space="preserve">';
    var t = '<w:t xml:space="preserve">';
    xml = xml.replace(t + 'Mairie de </w:t></w:r><w:r>' + ital + '[commune]</w:t>', t + echappe(ligneMairie(genre, ctx)) + '</w:t>');
    if (!v['[Téléphone]'] || !v['[Courriel]']) xml = xml.replace('<w:r>' + t + ' — </w:t></w:r>', '');
    Object.keys(v).forEach(function (k) {
      // Champ laissé vide : il reste dans le Word, à remplir à la main.
      if (!v[k] && !/^\[(Courriel|Téléphone|Signature)\]$/.test(k)) return;
      var val = echappe(v[k]), cle = echappe(k);
      xml = xml.split(ital + cle + '</w:t>').join(t + val + '</w:t>').split(cle).join(val);
    });
    return xml;
  }

  // Corps modifié dans le Word : la formule d'appel garde la mise en forme de
  // celle du modèle, les paragraphes suivants celle du premier paragraphe.
  function remplacerCorps(xml, paras) {
    var ps = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
    var txt = ps.map(function (p) { return (p.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(function (x) { return x.replace(/<[^>]+>/g, ''); }).join(''); });
    var b = bornes(txt);
    if (b[0] < 0 || b[1] < b[0] || !paras.length) return xml;
    var pPr = function (p) { var m = p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/); return m ? m[0] : ''; };
    var appel = pPr(ps[b[0]]), corpsPr = pPr(ps[b[0] + 2] || ps[b[0]]), vide = ps[b[0] + 1];
    var para = function (pr, t) { return '<w:p>' + pr + '<w:r><w:t xml:space="preserve">' + echappe(t) + '</w:t></w:r></w:p>'; };
    var neuf = para(appel, paras[0]) + (vide && !txt[b[0] + 1].trim() ? vide : '')
      + paras.slice(1).map(function (t) { return para(corpsPr, t); }).join('');
    var debut = xml.indexOf(ps[b[0]]), fin = xml.indexOf(ps[b[1]], debut) + ps[b[1]].length;
    return xml.slice(0, debut) + neuf + xml.slice(fin);
  }

  // Adresse postale d'envoi ; depuis l'étranger, « France » en plus.
  function poste(genre, ctx) {
    var pays = ctx.etranger ? ', France' : '';
    if (genre === 'dep') return 'Assemblée nationale, 126, rue de l’Université, 75355 Paris 07 SP' + pays;
    if (genre === 'sen') return 'Sénat, 15, rue de Vaugirard, 75291 Paris Cedex 06' + pays;
    var m = genre === 'arr' ? ctx.arr : ctx.mai;
    return ligneMairie(genre, ctx) + ', ' + m.rue + ', ' + m.cp;
  }

  // Français de l'étranger : la ville de la lettre (« À Berlin, le… »), tirée
  // de la ligne « code postal et commune » saisie.
  function villeSaisie(s) {
    return String(s || '').split(',')[0].replace(/^[\s\dA-Z-]*\d[\s\dA-Z-]*\s+(?=\S)/, '').trim();
  }

  var api = { OBJET: OBJET, COPIE: COPIE, dateFr: dateFr, mairieDe: mairieDe, appel: appel, valeurs: valeurs,
    remplir: remplir, courriel: courriel, remplirXml: remplirXml, poste: poste, modele: modele,
    corpsModele: corpsModele, bornes: bornes, paragraphes: paragraphes, villeSaisie: villeSaisie };
  if (typeof module === 'object' && module.exports) module.exports = api; else racine.Lettres = api;
})(this);
