"""niches.json — the 465 tax expenditures of the PLF 2026 annex « Dépenses fiscales »
(Voies et moyens, tome II, annexe 3), plus the 81 « modalités de calcul de l'impôt »
(dépenses fiscales déclassées, not counted in the 465) and the aggregate of the
21 reduced VAT rates that the PLF does not count as niches.

Joins on the niche number across the sheets
  Chiffrages Résolution (labels, tax, beneficiaries count, 2024 cost, Résolution typology),
  Chiffrages (2024 / 2025 / 2026 costs), Échéances (dates), Bénéficiaires (nature),
  Explication détaillée (purpose), Méthodologie, Références juridiques,
  Programme de rattachement (budget programme).
All joins are checked to be 1:1 on the 465 ids.

Cost cells carry three kinds of non-numeric markers (sheet legend): « - » no budgetary
effect, « ε » below 0,5 M€ and not computed, « nc » not computed.  They are exported as
null plus a flag (aucun_effet / epsilon / nc) — never as 0.

Coarse category (for filters) = ONE category per niche, first matching rule:
  1. outre-mer   label mentions an overseas territory
  2. TVA         tax = taxe sur la valeur ajoutée
  3. épargne     label mentions livret / épargne / PEA / PEL / assurance-vie / capitalisation / PER
  4. logement    label mentions housing terms, or local tax TFPB / TH
  5. ménages | entreprises   by beneficiary nature (Bénéficiaires sheet)
  6. autre       everything else (mixed beneficiaries, vehicles, parcels, premises)
`category_tags` lists every rule that fires; `category_rule` says which fired first.

Two readings of « what the plan does with each niche », kept side by side:
  * `resolution.suppression_code` / `plan_classeur`: the authors' own column « Suppression » of their copy of the
    workbook (Oui / En 3 ans / Fusion CI IR / Flux OM / blank);
  * `resolution.plan_texte`: what the TEXT of PLF-P1 n° 1 says (III lists the abrogated provisions by number; IV.A to
    IV.F give each group of numbers its own calendar).  Each niche's legal reference is matched to the III items
    (article and sub-paragraph), the group is read in IV; a niche matched to several groups, or to none, gets
    `groupe: null` (no claim).  Where the two readings disagree, `plan_final` follows the text and
    `plan_conflit_classeur` is true.

The reading of the 18 Nov 2026 text (Am. 1, II 4°, II last paragraph, III bis, IV.A/D/E):
  * TVA: only the 21 CIBS items of the III bis remove rate lines (1 Jul 2027); II 4° keeps every other reduced or
    derogatory VAT rate; the exemptions and special regimes (261, 291, 293 B…) are not « taux » so the general rule
    I + IV.D applies; the exposé of Am. 21 announces that « une disposition distincte » suppresses all of them on
    1 Jul 2027, which the text does not do (flagged conflict, not a deletion);
  * overseas: « Ne relèvent pas du I et du III les dispositions propres aux collectivités régies par l'article 73 ou
    74 de la Constitution et à la Nouvelle-Calédonie » (II, last paragraph): out of the amendment, no date;
  * Am. 8 (crédit d'impôt de remplacement agricole) and Am. 18 (199 undecies C, 244 quater X, 244 quater Y) carry
    their own dates for niches that the III does not cite.
"""
from __future__ import annotations

import collections
import re
import unicodedata

from amend import amendment, page_label, pdf_url, quote_pages
from lib import Sheet, cell_flag, clean, parse_num, ws

# --------------------------------------------------------------------------
# What PLF-P1 n° 1 says about each niche (III = list of abrogated provisions, IV = calendar by group)
# --------------------------------------------------------------------------
GROUPS_FR = {
    # (label, effet, où dans le texte, citation, n° de l'amendement — 1 par défaut)
    "A": ("Cas général", "impôt sur le revenu dû au titre de 2026, impôt sur les sociétés des exercices clos à partir du 1er janvier 2027, impôt sur la fortune immobilière et impositions locales dus au titre de 2027, droits d'enregistrement à partir du 1er janvier 2027", "IV.A",
          "le I s’applique à l’impôt sur le revenu dû au titre de 2026"),
    "B": ("Avantage lié à un engagement", "investissements réalisés, dépenses payées, versements effectués et engagements pris à partir du 1er janvier 2027", "IV.B",
          "aux engagements pris à compter du 1er janvier 2027"),
    "C": ("Barème, parts et plus-values", "impôt sur le revenu dû au titre de 2028 et opérations à partir du 1er janvier 2028 (plans, comptes et livrets : plus d'avantage pour les ouvertures et versements à partir du 1er juillet 2027)", "IV.C",
          "le I s’applique à l’impôt sur le revenu dû au titre de 2028 et aux opérations réalisées à compter du 1er janvier 2028"),
    "C0": ("Cessions et exportations (82° et 83°)", "cessions et exportations à partir du 1er janvier 2027", "IV.C, dernière phrase",
           "le I s’applique aux cessions et aux exportations intervenant à compter du 1er janvier 2027"),
    "Cbis": ("Mutations à titre gratuit", "successions ouvertes et donations consenties à partir du 1er janvier 2027", "IV.C bis",
             "aux successions ouvertes et aux donations consenties à compter du 1er janvier 2027"),
    "D": ("TVA (exonérations et régimes particuliers), accises et douane", "opérations dont le fait générateur est à partir du 1er juillet 2027", "IV.D",
          "aux opérations dont le fait générateur intervient à compter du 1er juillet 2027"),
    "D3bis": ("TVA : taux nommés au III bis", "lignes de taux réduit ou dérogatoire du code des impositions sur les biens et services que le III bis supprime, pour les opérations dont le fait générateur est à partir du 1er juillet 2027", "III bis, dernier alinéa",
              "Le présent III bis s’applique aux opérations dont le fait générateur intervient à compter du 1er juillet 2027"),
    "D3bisPart": ("TVA : taux en partie nommé au III bis", "seules les lignes que le III bis nomme sont supprimées (1er juillet 2027) ; le reste du taux est maintenu par le II, 4°", "II, 4°, et III bis",
                  "Qui fixent un taux réduit ou dérogatoire de taxe sur la valeur ajoutée, à l’exception de celles que le III abroge"),
    "Dmaint": ("TVA : taux non nommé, maintenu par le texte", "taux réduit ou dérogatoire de TVA que ni le III ni le III bis ne nomment : le II, 4° le laisse hors du I (l'exposé du n° 21 annonce pourtant une suppression au 1er juillet 2027)", "II, 4°",
               "Qui fixent un taux réduit ou dérogatoire de taxe sur la valeur ajoutée, à l’exception de celles que le III abroge"),
    "E": ("Agriculture, services à la personne, garde des jeunes enfants", "avantage réduit d'un tiers au titre de 2027, de deux tiers au titre de 2028, supprimé en totalité à partir de 2029", "IV.E",
          "l’avantage est réduit d’un tiers au titre de 2027 et de deux tiers au titre de 2028"),
    "E8": ("Crédit d'impôt de remplacement des exploitants agricoles", "crédit d'impôt réduit d'un tiers pour les dépenses engagées en 2027, de deux tiers pour celles de 2028, abrogé à partir des dépenses engagées en 2029", "V, A",
           "est réduit d’un tiers pour les dépenses engagées en 2027 et de deux tiers pour les dépenses engagées en 2028", 8),
    "B18": ("Aides à l'investissement abrogées par le n° 18", "abrogées pour les investissements dont le fait générateur est à partir du 1er janvier 2027 (les opérations déjà engagées et achevées avant le 1er juillet 2029 restent au droit ancien)", "IV, B",
            "Les A, C et E du II s’appliquent aux investissements dont le fait générateur intervient à compter du 1er janvier 2027", 18),
    "F": ("Dons et versements", "avantage réduit de moitié pour les dons à partir du 1er juillet 2027, supprimé à partir du 1er janvier 2028", "IV.F",
          "l’avantage est réduit de moitié pour les dons et versements effectués à compter du 1er juillet 2027"),
    "OM": ("Outre-mer : hors du champ de l'amendement", "dispositions propres aux collectivités des articles 73 et 74 de la Constitution et à la Nouvelle-Calédonie : ni le I ni le III ne s'y appliquent (régime fiscal distinct), donc pas de date", "II, dernier alinéa",
           "Ne relèvent pas du I et du III les dispositions propres aux collectivités régies par l’article 73 ou par l’article 74 de la Constitution et à la Nouvelle-Calédonie, qui sont régies par un régime fiscal distinct"),
}
# Groupes qui donnent un échelonnement par tiers jusqu'en 2029
TROIS_ANS_GROUPS = {"E", "E8"}

# Niches dont la référence légale n'est citée par aucun numéro du III, lues autrement.
# (groupe, numéros du III ou None, explication, inféré ?) — la note est affichée sous la niche.
PLAN_TEXT_OVERRIDES = {
    "110203": ("E", [150], "Le crédit d'impôt pour frais de garde des enfants de moins de 6 ans (art. 200 quater B) n'est cité par aucun numéro du III. Le seul numéro du IV.E qui ne désigne pas un article est le 150° (« 23° bis du II de la section V »), et le IV.E vise « la garde des jeunes enfants » ; l'article 28 VII, qui fusionne des crédits dans l'aide fondamentale, ne cite pas non plus l'article 200 quater B. Rapprochement non vérifié sur Légifrance (injoignable).", True),
    "110107": ("C", None, "L'article 194 (quotient conjugal) n'est pas dans le III : il est abrogé par PLF-P1 n° 28, V, 2°, pour l'imposition des revenus de 2028 (« Le 1°, le 2° et le 3° du V s’appliquent à l’imposition des revenus de l’année 2028 »).", False),
    "110201": ("F", [148], "La réduction d'impôt pour dons (art. 200) est le 20° du II de la section V (III 148°), cité par le IV.F.", False),
    # M3 : l'article 200 undecies n'est pas dans le III, l'amendement n° 8 l'échelonne lui-même
    "110240": ("E8", None, "L'article 200 undecies (crédit d'impôt de remplacement des exploitants agricoles) n'est cité par aucun numéro du III : l'amendement n° 8 (V, A) le réduit d'un tiers pour les dépenses engagées en 2027, de deux tiers pour celles de 2028 et l'abroge à partir de 2029 (II, B).", False),
    # 60203 : IV.E est défini par la nature (« activités agricoles… au nombre desquelles »), non par une liste fermée
    "60203": ("E", None, "L'article 1647-00 bis (dégrèvement d'office des jeunes agriculteurs) n'est cité par aucun numéro du III. Le IV.E vise les dispositions « relatives aux activités agricoles, aux services à la personne et à la garde des jeunes enfants, au nombre desquelles » celles qu'il numérote : la liste n'est pas fermée. Lecture par la nature du dispositif, non par un numéro.", True),
    # M4 : 81 A n'est ni agricole, ni service à la personne, ni garde d'enfants
    "120124": ("A", None, "L'article 81 A (salariés détachés à l'étranger) n'est cité par aucun numéro du III ni du III quater ou quinquies, et n'est ni agricole, ni un service à la personne, ni une garde d'enfants : il ne relève pas du IV.E, malgré la mention « En 3 ans » du classeur. Le cas général du IV.A s'applique (impôt sur le revenu dû au titre de 2026). Lecture par exclusion, non par un numéro.", True),
    # M2 : les articles 199 undecies A à C sont cités par le III (135°, IV.B) ; 244 quater X et Y ne le sont que par l'amendement n° 18
    "110210": ("B", [135], "L'article 199 undecies A est cité par le III 135° (« Les articles 199 undecies A à 199 undecies C », IV.B : investissements réalisés à partir du 1er janvier 2027). Avantage d'investisseurs : il reste dans le champ de l'amendement n° 1 malgré le II, dernier alinéa (bénéfice accordé à une personne non domiciliée outre-mer).", False),
    "110224": ("B", [135], "L'article 199 undecies B est cité par le III 135° (« Les articles 199 undecies A à 199 undecies C », IV.B : investissements réalisés à partir du 1er janvier 2027). Avantage d'investisseurs : il reste dans le champ de l'amendement n° 1 malgré le II, dernier alinéa (bénéfice accordé à une personne non domiciliée outre-mer).", False),
    "110256": ("B", [135], "L'article 199 undecies C est cité par le III 135° (IV.B : investissements réalisés à partir du 1er janvier 2027) et abrogé aussi par l'amendement PLF-P1 n° 18 (II, C), les opérations engagées et achevées avant le 1er juillet 2029 restant au droit ancien.", False),
    "320136": ("B18", None, "L'article 244 quater X est abrogé par l'amendement PLF-P1 n° 18 (II, C) pour les investissements dont le fait générateur est à partir du 1er janvier 2027, les opérations engagées et achevées avant le 1er juillet 2029 restant au droit ancien. Le III de l'amendement n° 1 ne le cite pas.", False),
    "320146": ("B18", None, "L'article 244 quater Y est abrogé par l'amendement PLF-P1 n° 18 (III, E) pour les investissements dont le fait générateur est à partir du 1er janvier 2027, les opérations engagées et achevées avant le 1er juillet 2029 restant au droit ancien. Le III de l'amendement n° 1 ne le cite pas.", False),
}
# M2 : dispositions propres à l'outre-mer, hors du champ de l'amendement n° 1 (II, dernier alinéa). Les « Flux OM » du classeur
# (suppression_code) y sont aussi, voir `_plan_texte`. Les avantages accordés à des personnes non domiciliées outre-mer
# (investisseurs : 110210, 110224, 110260, 320113, 210325) restent dans le champ (seconde phrase du même alinéa).
HORS_CHAMP_OM = {"50109", "60108", "90108", "110302", "210322", "500102", "550105", "710109", "710110", "990202"}
DANS_LE_CHAMP_OM = {"110210", "110224", "110260", "320113", "210325"}
NOTE_OM = "Disposition propre à une collectivité d'outre-mer (article 73 ou 74 de la Constitution, Nouvelle-Calédonie) : « Ne relèvent pas du I et du III les dispositions propres aux collectivités régies par l’article 73 ou par l’article 74 de la Constitution et à la Nouvelle-Calédonie » (PLF-P1 n° 1, II, dernier alinéa). Le texte ne lui donne pas de date ; régime fiscal distinct."
NOTE_OM_INVEST = "Dispositif d'investissement outre-mer : le II (dernier alinéa) exclut les dispositions propres aux collectivités d'outre-mer, mais pas celles dont le bénéfice est accordé à une personne qui n'est pas domiciliée dans ces collectivités (investisseurs de métropole). Nous la laissons dans le champ de l'amendement n° 1 ; date non affirmée."

# TVA — Am. 1, II 4° (« taux réduit ou dérogatoire … à l'exception de celles que le III abroge »), III bis, IV.D.
# Lecture par l'intitulé : la correspondance CGI → CIBS (L. 213-xxx) n'est pas dans le dépôt et Légifrance est injoignable.
# Pour chaque niche nommée, le numéro du III bis qui supprime la ligne de taux (21 numéros, tous au 1er juillet 2027).
TVA_NOMMEES = {
    "720201": "4° et 6° (lignes de transport de personnes et de biens entre la Corse et le reste de la métropole)",
    "720206": "2° (ligne « Poissons, crustacés et mollusques … livrés par le pêcheur »)",
    "730205": "17° (ligne « Hébergement à usage touristique »)",
    "730206": "17° (ligne « Mise à disposition de terrains de camping ou caravanage »)",
    "730210": "21° (ligne « Autres logements locatifs sociaux ainsi que les travaux d’extension ou de remise à neuf »)",
    "730212": "3° (ligne « Produits améliorant la culture agricole et pouvant être utilisés en agriculture biologique »)",
    "730213": "15° (ligne « Autres travaux légers sur un logement qui n’est pas neuf »)",
    "730216": "20° et 21° (lignes d'accession sociale à la propriété et de logements locatifs sociaux)",
    "730221": "17° (ligne « Restauration et produits alimentaires … préparés en vue d’une consommation immédiate »)",
    "730222": "21° (ligne « Logements locatifs intermédiaires »)",
    "730223": "15° (ligne « Travaux légers de rénovation énergétique sur un logement qui n’est pas neuf »)",
    "730224": "14° (ligne « Manifestations sportives »)",
    "730226": "7° (ligne « Services de gestion des déchets des ménages »)",
    "730228": "11° (ligne « Objets d’art, de collection ou d’antiquité »)",
    "730231": "14° (ligne « Représentations théâtrales, concerts, spectacles de cirque, spectacles de variété, cinéma, compétitions de jeux vidéo »)",
    "730233": "14° (ligne « Service de télévision »)",
    "730234": "15° (ligne « Pose, installation et entretien d’infrastructures de recharge pour véhicules électriques »)",
    "730236": "15° (ligne « Livraison et installation de panneaux solaires »)",
    "730301": "14° (ligne « 140 premières représentations théâtrales, d’un concert ou d’un spectacle de cirque »)",
    "730302": "3° (ligne « Animaux de boucherie ou de charcuterie vivants à destination des petits agriculteurs »)",
    "730305": "8° à 10° (ligne « Publications de presse » et critères de la presse)",
    "730306": "les lignes « en Corse » des 2°, 3°, 4°, 6°, 7°, 11° à 14°, 16°, 17° et 18°",
}
# Nommés en partie : une ligne du III bis ne couvre qu'une fraction du taux (le reste est maintenu par le II, 4°).
TVA_PARTIELLES = {
    "730207": "Le 17° du III bis ne supprime que la ligne « Restauration dans les cantines d’entreprise, en Corse » : le taux de 10 % des cantines hors de Corse n'est pas nommé.",
    "730227": "Le 19° du III bis ne supprime que les lignes « Travaux légers portant sur les logements locatifs sociaux et les établissements sociaux et médico-sociaux » et les services qui s'y rapportent : le reste du taux de 5,5 % du secteur social et médico-social n'est pas nommé.",
}
# Taux ni dans le III ni dans le III bis : le II, 4° les laisse hors du I.
TVA_NON_NOMMES = {"730208", "730214", "730218", "730230", "730232", "730235"}
# Exonérations, franchises et régimes particuliers : pas des « taux », le II, 4° ne les couvre pas ; règle générale I + IV.D.
TVA_REGLE_GENERALE = {"720106", "720107", "720108", "720207", "740105", "740107"}
NOTE_TVA_NON_NOMME = (
    "Aucune ligne du III bis ne correspond à ce taux et aucun numéro du III ne cite l'article : le II, 4° (« Qui fixent un taux réduit ou dérogatoire de taxe sur la valeur ajoutée, à l’exception de celles que le III abroge ») le laisse hors du I. "
    "Les exposés disent autre chose : celui du n° 21 écrit que « Les taux dérogatoires recensés comme dépenses fiscales ne sont pas visés ici : une disposition distincte les supprime au 1er juillet 2027 », "
    "et celui du n° 1 date « les taux réduits de taxe sur la valeur ajoutée au 1er juillet 2027 » tout en rangeant parmi les exceptions « les taux réduits … autres que ceux que le III abroge ». "
    "Texte et exposé divergent : nous signalons le conflit sans le trancher et ne comptons pas ce taux comme supprimé."
)
NOTE_TVA_REGLE_GENERALE = (
    "Exonération, franchise ou régime particulier de TVA : ce n'est pas un « taux réduit ou dérogatoire », le II, 4° ne s'y applique pas. La règle générale du I et du IV.D vise la taxe sur la valeur ajoutée à partir du 1er juillet 2027, "
    "sous réserve du II, 3° (disposition qui résulte d'une obligation du droit de l'Union européenne), que nous n'avons pas examiné niche par niche."
)
_ARTONLY = re.compile(r"^\d{1,4}(?:-\d+)?(?: (?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies|undecies|duodecies|terdecies|quaterdecies|quindecies|sexdecies|septdecies|octodecies|novodecies|vicies|[A-Z]{1,3}))*$")
_STOP = {"le", "la", "les", "l", "d", "de", "du", "des", "et", "à", "au", "aux", "article", "articles", "même", "code", "section", "chapitre", "titre", "partie", "livre", "sous", "première", "premier"}


def _toks(txt: str) -> set[str]:
    txt = txt.lower().replace("’", "'").replace("'", " ")
    txt = re.sub(r"[\-,.;:()«»]", " ", txt)
    return {t for t in txt.split() if t and t not in _STOP}


def _item_skip(txt: str) -> bool:
    return bool(re.search(r"\bL\. ?\d|\bR\. ?\d|\bloi\b", txt))


def _am1_structure() -> dict:
    """III items (350) and the item numbers of each IV group, parsed from the amendment text and sanity-checked."""
    a = amendment("PLF-P1", 1)
    txt = a["dispositif"]
    iii = txt[txt.index("III. – Sont abrogés") : txt.index("III bis.")]
    items: dict[int, str] = {}
    exp, cur = 1, None
    for line in (l.strip() for l in iii.split("\n")[1:]):
        m = re.match(r"^(\d{1,3})°\s*(.*)$", line)
        if m and int(m.group(1)) == exp:
            cur = exp
            items[cur] = m.group(2)
            exp += 1
        elif cur is not None and line:
            items[cur] += " " + line
    assert len(items) == 350, len(items)
    iv = txt[txt.index("IV. – A.") :]

    def rng(spec: str) -> set[int]:
        out: set[int] = set()
        for piece in spec.replace(" et ", ", ").split(","):
            piece = piece.strip()
            if piece:
                m = re.fullmatch(r"(\d+)°(?: à (\d+)°)?", piece)
                assert m, piece
                out |= set(range(int(m.group(1)), int(m.group(2) or m.group(1)) + 1))
        return out

    def grab(start: str, end: str) -> set[int]:
        k = iv.index(start)
        seg = re.sub(r"\s+", " ", iv[k : iv.index(end, k + 5)])
        m = re.search(r"que le III abroge à ses (.+?), (?:le I s’applique|l’avantage est réduit)", seg)
        assert m, start
        return rng(m.group(1))

    groups = {
        "B": grab("B. – Sous réserve des C à F", "C. – Par dérogation"),
        "C": grab("C. – Par dérogation aux A et B, pour", "C bis. –"),
        "Cbis": grab("C bis. –", "D. – En matière"),
        "E": grab("E. – Par dérogation", "F. – Par dérogation"),
        "F": grab("F. – Par dérogation au A", "G. – Les créances"),
    }
    assert {k: len(v) for k, v in groups.items()} == {"B": 91, "C": 44, "Cbis": 22, "E": 29, "F": 6}, {k: len(v) for k, v in groups.items()}
    assert groups["E"] >= {31, 142, 150, 158, 159, 162, 263} and 197 not in groups["E"] and {195, 196, 197, 198, 199} <= groups["B"]
    # IV.C, last sentence: the 82° and 83° apply to sales and exports from 1 January 2027
    assert "pour les dispositions que le III abroge à ses 82° et 83°" in re.sub(r"\s+", " ", iv)
    groups["C0"] = {82, 83}
    groups["C"] = groups["C"] - groups["C0"]
    pure: dict[int, set[str]] = {}
    for k, v in items.items():
        m = re.match(r"^(?:L’article|Les articles) (.+?) du même code\.$", v)
        if m and not _item_skip(v) and " le " not in m.group(1) and " les " not in m.group(1):
            pure[k] = {re.sub(r"\s+", " ", p.strip()).lower() for p in re.split(r", | et ", m.group(1))}
    return {"items": items, "groups": groups, "tokens": {k: _toks(v) for k, v in items.items() if not _item_skip(v)}, "pure": pure}


def _group_of_item(st: dict, k: int) -> str:
    for g in ("E", "F", "Cbis", "C0", "C", "B"):
        if k in st["groups"][g]:
            return g
    return "A"


def _pieces(ref: str) -> list[str]:
    out: list[str] = []
    for p in (q.strip() for q in re.split(r",\s+|;\s*|\s+et\s+", ref) if q.strip()):
        if re.match(r"^\d{2,4}(?![\d°])", p) or not out:
            out.append(p)
        else:
            out[-1] += " " + p  # « 3° bis », « 10° et 11° » continue the previous article
    return out


def _match_items(st: dict, ref: str) -> list[int]:
    hits: set[int] = set()
    for piece in _pieces(ref):
        if _ARTONLY.match(piece):
            hits |= {k for k, arts in st["pure"].items() if piece.lower() in arts}
        else:
            t = _toks(piece)
            if len(t) >= 2:
                hits |= {k for k, tt in st["tokens"].items() if t <= tt}
    return sorted(hits)


def _plan_texte(st: dict, niche: dict) -> dict:
    """What PLF-P1 n° 1 says about one niche (see module docstring).  `afficher_note` = the note is specific to this
    niche and is shown under it on the page; `conflit_expose` = the text and an exposé of the same liasse disagree."""
    i, tax, code, ref = niche["id"], niche["tax"], niche["legal_ref"]["code"] or "", niche["legal_ref"]["reference"] or ""
    suppression = niche["resolution"]["suppression_code"]
    if i in PLAN_TEXT_OVERRIDES:
        g, items, why, inferred = PLAN_TEXT_OVERRIDES[i]
        return {"groupe": g, "iii": items, "methode": "rapprochement hors article" if items is None or inferred else "article cité par le III", "inferred": inferred, "note_fr": why, "afficher_note": True}
    # M2 — outre-mer : hors du champ de l'amendement (II, dernier alinéa) ; les « Flux OM » du classeur en font partie
    if i in HORS_CHAMP_OM or suppression == "Flux OM":
        return {"groupe": "OM", "iii": None, "methode": "II, dernier alinéa (outre-mer)", "inferred": False, "note_fr": NOTE_OM, "afficher_note": True}
    if i in DANS_LE_CHAMP_OM:
        pt = _plan_texte_generic(st, niche)
        pt["note_fr"] = NOTE_OM_INVEST + (" " + pt["note_fr"] if pt.get("note_fr") else "")
        pt["afficher_note"] = True
        return pt
    # TVA — II, 4° et III bis (M1)
    if i in TVA_NOMMEES:
        return {"groupe": "D3bis", "iii": None, "methode": "III bis (rapprochement par l'intitulé)", "inferred": False, "afficher_note": True,
                "note_fr": f"Ligne de taux nommée au III bis, {TVA_NOMMEES[i]} : supprimée pour les opérations dont le fait générateur est à partir du 1er juillet 2027. Rapprochement par l'intitulé (la numérotation du code des impositions sur les biens et services n'a pas pu être vérifiée à la source)."}
    if i in TVA_PARTIELLES:
        return {"groupe": "D3bisPart", "iii": None, "methode": "III bis en partie (rapprochement par l'intitulé)", "inferred": False, "afficher_note": True, "conflit_expose": True,
                "note_fr": TVA_PARTIELLES[i] + " Le II, 4° maintient le reste ; l'exposé du n° 21 annonce pourtant la suppression au 1er juillet 2027 : conflit signalé, non tranché."}
    if i in TVA_NON_NOMMES:
        return {"groupe": "Dmaint", "iii": None, "methode": "II, 4° (taux non nommé)", "inferred": False, "afficher_note": True, "conflit_expose": True, "note_fr": NOTE_TVA_NON_NOMME}
    if i in TVA_REGLE_GENERALE:
        return {"groupe": "D", "iii": None, "methode": "règle générale du I et du IV.D (exonération ou régime particulier de TVA)", "inferred": False, "afficher_note": True, "note_fr": NOTE_TVA_REGLE_GENERALE}
    return _plan_texte_generic(st, niche)


NOTE_CAS_GENERAL = (
    "Aucun numéro du III ne cite cette référence. Le cas général du IV.A s'applique, sous réserve des B à F : impôt sur le revenu dû au titre de 2026, "
    "impôt sur les sociétés des exercices clos à compter du 1er janvier 2027, impôt sur la fortune immobilière et impositions directes locales dus au titre de 2027, "
    "droits d'enregistrement et de timbre des actes et mutations à compter du 1er janvier 2027. Le 1er janvier 2028 (I, A, dernière phrase) ne vaut que pour ce que le IV ne couvre pas."
)


def _plan_texte_generic(st: dict, niche: dict) -> dict:
    i, tax, code, ref = niche["id"], niche["tax"], niche["legal_ref"]["code"] or "", niche["legal_ref"]["reference"] or ""
    cibs_or_customs = "impositions sur les biens" in code or "douanes" in code
    if tax in ("Taxe sur la valeur ajoutée", "Accise sur les énergies") or cibs_or_customs:
        nums = [int(x) for x in re.findall(r"L\. ?312-(\d+)", ref)]
        if any(60 <= n <= 63 for n in nums):  # III 318° : « L. 312-60 à L. 312-63 », cited by IV.E
            return {"groupe": "E", "iii": [318], "methode": "article du CIBS cité par le III", "inferred": False, "note_fr": "L. 312-60 à L. 312-63 du code des impositions sur les biens et services (III 318°), dans la liste du IV.E."}
        return {"groupe": "D", "iii": None, "methode": "règle du IV.D par impôt", "inferred": False, "note_fr": "Le IV.D fixe le 1er juillet 2027 pour la TVA, les impositions des livres III et IV du code des impositions sur les biens et services et le code des douanes ; la liste exacte des numéros du III n'est pas rapprochée niche par niche."}
    if "général des impôts" not in code:
        return {"groupe": None, "iii": None, "methode": "non rapproché", "inferred": False, "note_fr": "Référence légale hors code général des impôts : non rapprochée du III."}
    hits = _match_items(st, ref)
    gs = sorted({_group_of_item(st, k) for k in hits})
    if len(gs) == 1:
        return {"groupe": gs[0], "iii": hits, "methode": "article et alinéa cités par le III", "inferred": False, "note_fr": None}
    if len(gs) > 1:
        return {"groupe": None, "iii": hits, "methode": "ambigu", "inferred": False, "ambigu": gs,
                "note_fr": "Les numéros du III qui citent ces articles relèvent de plusieurs groupes du IV (" + ", ".join(gs) + ") : aucune date n'est affirmée niche par niche."}
    return {"groupe": None, "iii": None, "methode": "non rapproché", "inferred": False, "note_fr": NOTE_CAS_GENERAL}


def _plan_final(base: str, groupe: str | None) -> str:
    if base == "eteinte":
        return base
    if groupe in TROIS_ANS_GROUPS:
        return "trois-ans"
    if groupe == "OM":
        return "outre-mer"
    if groupe == "Dmaint":
        return "maintenue"
    if groupe == "D3bisPart":
        return "partielle"
    if base == "trois-ans" and groupe is not None:
        return "supprimee"
    return base


PLAN_OF_CODE = {"Oui": "supprimee", "En 3 ans": "trois-ans", "Fusion CI IR": "aide-fondamentale", "Flux OM": "outre-mer", None: "eteinte"}


def _group_sources() -> dict:
    out = {}
    for g, spec in GROUPS_FR.items():
        label, effect, where, quote = spec[:4]
        n = spec[4] if len(spec) > 4 else 1
        first, last = quote_pages("PLF-P1", n, quote)
        out[g] = {"label_fr": label, "effet_fr": effect, "ou_fr": f"Amendement PLF-P1 n° {n}, {where} ({page_label(first, last)} du PDF)", "url": pdf_url("PLF-P1", first), "quote": quote}
    return out


# --------------------------------------------------------------------------
# classification
# --------------------------------------------------------------------------
def _fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()


OUTRE_MER = re.compile(
    r"outre-mer|outremer|\bdom\b|guadeloupe|martinique|\breunion\b|guyane|mayotte|saint-pierre|polynesie|nouvelle-caledonie|wallis|article 73 de la constitution|terres australes"
)
EPARGNE = re.compile(
    r"livret|epargne|plan d'epargne|\bpea\b|\bpel\b|assurance-vie|assurance vie|contrats? de capitalisation|bons ou contrats|\bper\b|\bperp\b|plans d'epargne populaire|produits des plans"
)
LOGEMENT_STRONG = re.compile(
    r"logement|habitation|\bhlm\b|locatif|pinel|scellier|duflot|malraux|censi|denormandie|perissol|robien|borloo|cosse|\banah\b|residence principale|"
    r"pret a taux zero|loc'avantages|nu-proprietaire|deficit foncier|revenus fonciers|societe fonciere|proprietes baties|locaux a usage"
)
# weaker hits only count when the beneficiaries are not businesses (keeps SIIC / SPPICAV-type regimes out of « logement »)
LOGEMENT_WEAK = re.compile(r"immobilier|immobiliere|immeubles? (?:bati|classe|inscrit|a caractere social|anti-sismique)")
NOT_HOUSING = re.compile(r"vehicule")
# local taxes on built property / housing: counted as « logement » unless the label is about businesses
LOCAL_BUSINESS = re.compile(r"etablissement|entreprise|\bcfe\b|activite")


def classify(label: str, tax: str, subcat: str, benef: str):
    f = _fold(label)
    tags, first = [], None

    def hit(cat, rule, m=None):
        nonlocal first
        tags.append(cat)
        if first is None:
            first = (cat, rule + (f":{m.group(0)}" if m else ""))

    m = OUTRE_MER.search(f)
    if m:
        hit("outre-mer", "libellé~outre-mer", m)
    if tax == "Taxe sur la valeur ajoutée":
        hit("TVA", "impôt=TVA")
    m = EPARGNE.search(f)
    if m:
        hit("épargne", "libellé~épargne", m)
    nature = benef.replace("\xa0", " ")
    m = LOGEMENT_STRONG.search(f) if not NOT_HOUSING.search(f) else None
    if m is None and nature != "Entreprises" and not NOT_HOUSING.search(f):
        m = LOGEMENT_WEAK.search(f)
    if m:
        hit("logement", "libellé~logement", m)
    elif subcat in ("TFPB", "TH") and not LOCAL_BUSINESS.search(f):
        tags.append("logement")
        if first is None:
            first = ("logement", f"sous-catégorie={subcat}")
    if nature == "Ménages":
        tags.append("ménages")
        if first is None:
            first = ("ménages", "bénéficiaires=Ménages")
    elif nature == "Entreprises":
        tags.append("entreprises")
        if first is None:
            first = ("entreprises", "bénéficiaires=Entreprises")
    if first is None:
        first = ("autre", f"bénéficiaires={nature or 'n/d'}")
    # ordered, de-duplicated
    seen, ordered = set(), []
    for t in tags:
        if t not in seen:
            seen.add(t)
            ordered.append(t)
    return first[0], first[1], ordered


# editorial list of niches/provisions that most households meet (id -> (kind, reason))
HOUSEHOLD_EDITORIAL = {
    # explicit in the brief / fiches
    "110246": ("beneficiaire_direct", "emploi à domicile (crédit d'impôt)"),
    "110203": ("beneficiaire_direct", "garde d'enfants de moins de 6 ans (crédit d'impôt)"),
    "120401": ("beneficiaire_direct", "abattement de 10 % sur les pensions et retraites"),
    "110201": ("beneficiaire_direct", "dons : réduction d'impôt (IR)"),
    "110102": ("beneficiaire_direct", "demi-part : parent isolé ayant élevé seul un enfant"),
    "110103": ("beneficiaire_direct", "demi-part : anciens combattants de plus de 74 ans"),
    "110104": ("beneficiaire_direct", "demi-part : contribuables invalides"),
    "110107": ("beneficiaire_direct", "quotient conjugal des veufs ayant des enfants à charge"),
    "110109": ("beneficiaire_direct", "demi-part : enfant ou personne invalide rattachée"),
    "110110": ("beneficiaire_direct", "demi-part : parents isolés"),
    "110101": ("beneficiaire_direct", "demi-part supplémentaire à partir du 3e enfant"),
    "110106": ("beneficiaire_direct", "rattachement d'un enfant majeur ou orphelin majeur"),
    "110306": ("beneficiaire_direct", "décote de l'impôt sur le revenu"),
    "140102": ("beneficiaire_direct", "Livret A"),
    "140101": ("beneficiaire_direct", "épargne-logement (PEL, CEL)"),
    "140103": ("beneficiaire_direct", "livret bleu"),
    "140104": ("beneficiaire_direct", "livret de développement durable (LDDS)"),
    "140105": ("beneficiaire_direct", "livret d'épargne populaire (LEP)"),
    "140106": ("beneficiaire_direct", "livret jeune"),
    "140123": ("beneficiaire_direct", "plan d'épargne populaire"),
    "140119": ("beneficiaire_direct", "assurance-vie et contrats de capitalisation"),
    "140120": ("beneficiaire_direct", "assurance-vie en unités de compte (contrats avant 2014)"),
    "120128": ("beneficiaire_direct", "PEA : rente viagère au dénouement"),
    "140117": ("beneficiaire_direct", "PEA : dividendes capitalisés"),
    "150708": ("beneficiaire_direct", "PEA : gains de cession"),
    "140109": ("beneficiaire_direct", "épargne salariale"),
    "150701": ("beneficiaire_direct", "épargne salariale : gains de cession"),
    "120108": ("beneficiaire_direct", "participation, intéressement, abondement"),
    "120146": ("beneficiaire_direct", "heures supplémentaires"),
    "120111": ("beneficiaire_direct", "titres-restaurant (part employeur)"),
    "120112": ("beneficiaire_direct", "chèques-vacances"),
    "120113": ("beneficiaire_direct", "frais de transport domicile-travail pris en charge"),
    "120202": ("beneficiaire_direct", "prestations familiales et AAH exonérées d'impôt (remplacées par l'AFU)"),
    "110215": ("beneficiaire_direct", "frais de scolarité (secondaire)"),
    "110242": ("beneficiaire_direct", "frais de scolarité (supérieur)"),
    "110213": ("beneficiaire_direct", "frais de dépendance et d'hébergement"),
    "50101": ("beneficiaire_direct", "taxe foncière : exonération des personnes âgées ou de condition modeste"),
    "210313": ("beneficiaire_direct", "prêt à taux zéro (crédit d'impôt versé aux banques, avantage pour l'emprunteur)"),
    "100112": ("beneficiaire_direct", "déduction des versements PERP / épargne retraite individuelle"),
    "150113": ("beneficiaire_direct", "plus-value de cession de la résidence principale (exonération)"),
    "150208": ("beneficiaire_direct", "abattement pour durée de détention : plus-values immobilières"),
    "520119": ("beneficiaire_direct", "dons de sommes d'argent en famille (31 865 €)"),
    "520203": ("beneficiaire_direct", "abattement sur les donations aux petits-enfants"),
    "520204": ("beneficiaire_direct", "abattement sur la résidence principale (succession)"),
    # VAT: the household bears it through prices
    "730213": ("prix_consommation", "TVA à 10 % sur les travaux dans les logements anciens"),
    "730223": ("prix_consommation", "TVA à 5,5 % sur les travaux de rénovation énergétique"),
    "730221": ("prix_consommation", "TVA à 10 % sur la restauration"),
    "730205": ("prix_consommation", "TVA à 10 % sur l'hébergement hôtelier"),
    "730231": ("prix_consommation", "TVA à 5,5 % sur les spectacles (théâtre, cinéma, concerts)"),
    "730214": ("prix_consommation", "TVA à 10 % sur les services à la personne"),
}
HOUSEHOLD_MIN_BENEFICIARIES = 1_000_000  # rule: nature « Ménages » and ≥ 1 M bénéficiaires


def _dates(v):
    n = parse_num(v)
    if n is not None:
        return int(n)
    t = (v or "").strip()
    return t or None


def _cost(sh_val):
    n = parse_num(sh_val)
    if n is not None:
        return clean(n, 3), None
    return None, cell_flag(sh_val)


def _idstr(v: str) -> str:
    return str(int(float(v)))


def _rows(sh: Sheet, first_row: int, key_col: int = 3):
    return [r for r in sh.rows[first_row:] if len(r) > key_col and r[key_col].strip()]


def build() -> dict:
    cr = Sheet.get("niches", "Chiffrages_R_solution")
    ch = Sheet.get("niches", "Chiffrages")
    ec = Sheet.get("niches", "Ech_ances")
    be = Sheet.get("niches", "B_n_ficiaires")
    ex = Sheet.get("niches", "Explication_d_taill")
    me = Sheet.get("niches", "M_thodologie")
    rj = Sheet.get("niches", "R_f_rences_juridiques")
    pr = Sheet.get("niches", "Programme_de_rattachement")
    sy = Sheet.get("niches", "Synth_se")

    CR = {_idstr(r[3]): r for r in _rows(cr, 6)}
    CH = {_idstr(r[3]): r for r in _rows(ch, 4)}
    EC = {_idstr(r[3]): r for r in _rows(ec, 4)}
    BE = {_idstr(r[3]): r for r in _rows(be, 2)}
    EX = {_idstr(r[3]): r for r in _rows(ex, 3)}
    ME = {_idstr(r[3]): r for r in _rows(me, 2)}
    RJ = {_idstr(r[3]): r for r in _rows(rj, 2)}
    PR = collections.defaultdict(list)
    for r in _rows(pr, 4):
        PR[_idstr(r[3])].append(r)
    ids = list(CR)  # sheet order (tax, then number)
    assert len(ids) == 465 and len(set(ids)) == 465
    for name, d in (("CH", CH), ("EC", EC), ("BE", BE), ("EX", EX), ("ME", ME), ("RJ", RJ), ("PR", PR)):
        assert set(d) == set(ids), name

    recs = []
    for i in ids:
        a, c_, e, b, x, m, j, p = CR[i], CH[i], EC[i], BE[i], EX[i], ME[i], RJ[i], PR[i]
        # cross-check 2024 cost between the two sheets
        v_cr, f_cr = _cost(a[8])
        v_ch, f_ch = _cost(c_[5])
        assert (v_cr, f_cr) == (v_ch, f_ch), (i, a[8], c_[5])
        c24, f24 = v_ch, f_ch
        c25, f25 = _cost(c_[6])
        c26, f26 = _cost(c_[7])
        label = ws(a[4])
        assert ws(c_[4]) == label and ws(e[4]) == label and ws(b[4]) == label, i
        tax, subcat, subsub = ws(a[0]), ws(a[1]), ws(a[2])
        nature = ws(b[5]).replace("\xa0", " ")
        count = parse_num(b[6])
        assert parse_num(a[7]) == count or (count is None and parse_num(a[7]) is None), (i, a[7], b[6])
        cat, rule, tags = classify(label, tax, subcat, nature)
        main_prog = [r for r in p if r[7] == "A titre principal"]
        assert len(main_prog) == 1, i
        sec_prog = [r for r in p if r[7] != "A titre principal"]
        fin_fg = _dates(a[6])
        supp_code = ws(a[12]) or None
        flags = {}
        for yr, fl in (("2024", f24), ("2025", f25), ("2026", f26)):
            if fl:
                flags[yr] = fl
        purpose = " | ".join(ws(t) for t in x[5:] if t.strip())
        rec = {
            "id": i,
            "tax": tax,
            "subcategory": subcat or None,
            "subsubcategory": subsub or None,
            "label_fr": label,
            "beneficiaries": {"type": nature, "count": clean(count, 0) if count is not None else None,
                              "count_flag": "non_determine" if count is None and b[6].strip() == "Non déterminé" else None},
            "cost_2024_meur": c24, "cost_2025_meur": c25, "cost_2026_meur": c26,
            "cost_flags": flags or None,
            "legal_ref": {"reference_norm": ws(j[5]) or None, "code": ws(j[6]).replace("\xa0", " ") or None, "reference": ws(j[7]).lstrip("# ").strip() or None},
            "programme": {"code": int(float(main_prog[0][5])) if main_prog[0][5].strip() else None, "label_fr": ws(main_prog[0][6]),
                          "secondary": [{"code": int(float(r[5])) if r[5].strip() else None, "label_fr": ws(r[6])} for r in sec_prog] or None},
            "purpose_fr": purpose or None,
            "dates": {"creation": _dates(a[5]), "last_modified": _dates(e[6]), "fin_fait_generateur": fin_fg,
                      "fin_incidence_budgetaire": _dates(e[8]), "suppression": _dates(e[9]),
                      "motif_fr": ws(e[11]) or None},
            "eteint_avant_2025": isinstance(fin_fg, int) and fin_fg <= 2024,
            "eteint_fin_2025": isinstance(fin_fg, int) and fin_fg == 2025,
            "reliability": ws(m[5]) or None,
            "method_fr": ws(m[6]) or None,
            "category": cat, "category_rule": rule, "category_tags": tags,
            "resolution": {
                "suppression_code": supp_code,
                "pct_effet_net": clean(parse_num(a[10]), 4) if parse_num(a[10]) is not None else None,
                "pct_solde_brut": clean(parse_num(a[11]), 4) if parse_num(a[11]) is not None else None,
                "gage_csg_meur": clean(parse_num(a[13]), 3) if parse_num(a[13]) is not None else None,
                "solde_po_meur": clean(parse_num(a[14]), 3) if parse_num(a[14]) is not None else None,
                "typologie_se": ws(a[15]) or None,
                "type_dispositif": ws(a[16]) or None,
                "cost_2024_avec_tva_apu_meur": clean(parse_num(a[9]), 3) if parse_num(a[9]) is not None else None,
            },
        }
        recs.append(rec)

    # --- what the text of PLF-P1 n° 1 says, niche by niche
    st = _am1_structure()
    for r in recs:
        pt = _plan_texte(st, r)
        base = PLAN_OF_CODE[r["resolution"]["suppression_code"]]
        r["resolution"]["plan_classeur"] = base
        r["resolution"]["plan_texte"] = pt
        final = _plan_final(base, pt["groupe"])
        r["resolution"]["plan_final"] = final
        r["resolution"]["plan_conflit_classeur"] = final != base
        r["resolution"]["plan_lecture_inferee"] = pt["inferred"]
    # --- Résolution suppression codes
    by_code = collections.Counter(r["resolution"]["suppression_code"] for r in recs)
    assert by_code == {"Oui": 359, None: 82, "En 3 ans": 11, "Fusion CI IR": 7, "Flux OM": 6}, by_code
    # blank code == fait générateur éteint at the end of 2025 (fin <= 2025)
    blank = {r["id"] for r in recs if r["resolution"]["suppression_code"] is None}
    ext25 = {r["id"] for r in recs if r["eteint_avant_2025"] or r["eteint_fin_2025"]}
    assert blank == ext25, (len(blank), len(ext25))
    for r in recs:
        c = r["resolution"]["suppression_code"]
        r["resolution"]["suppression_fr"] = {
            "Oui": "supprimée dès l'entrée en vigueur (suppression immédiate)",
            "En 3 ans": "supprimée progressivement en trois ans",
            "Fusion CI IR": "fusionnée dans l'aide fondamentale (crédits d'impôt sur le revenu)",
            "Flux OM": "outre-mer : refondue (« flux OM » dans le classeur)",
            None: "sans objet : fait générateur éteint fin 2025 ou avant",
        }[c]
    # --- Household flags
    ids_set = set(ids)
    for r in recs:
        kind = reason = None
        if r["id"] in HOUSEHOLD_EDITORIAL:
            kind, reason = HOUSEHOLD_EDITORIAL[r["id"]]
            reason = "liste éditoriale : " + reason
        elif r["beneficiaries"]["type"] == "Ménages" and (r["beneficiaries"]["count"] or 0) >= HOUSEHOLD_MIN_BENEFICIARIES:
            kind, reason = "beneficiaire_direct", f"règle : nature « Ménages » et au moins {HOUSEHOLD_MIN_BENEFICIARIES:,} bénéficiaires".replace(",", " ")
        r["household_common"] = kind is not None
        r["household_common_kind"] = kind
        r["household_common_reason"] = reason
    editorial_in_465 = {k for k in HOUSEHOLD_EDITORIAL if k in ids_set}

    # --- aggregates
    total24 = clean(sum(r["cost_2024_meur"] or 0 for r in recs), 3)
    total25 = clean(sum(r["cost_2025_meur"] or 0 for r in recs), 3)
    total26 = clean(sum(r["cost_2026_meur"] or 0 for r in recs), 3)
    assert total24 == 89406, total24
    assert abs(sy.num("D7") * 1000 - total24) < 1e-6

    def agg(key_fn, extra=None):
        g = collections.OrderedDict()
        for r in recs:
            k = key_fn(r)
            d = g.setdefault(k, {"count": 0, "cost_2024_meur": 0.0, "cost_2025_meur": 0.0, "cost_2026_meur": 0.0, "household_common_count": 0, "household_common_cost_2024_meur": 0.0})
            d["count"] += 1
            for y in ("2024", "2025", "2026"):
                d[f"cost_{y}_meur"] += r[f"cost_{y}_meur"] or 0
            if r["household_common"]:
                d["household_common_count"] += 1
                d["household_common_cost_2024_meur"] += r["cost_2024_meur"] or 0
        out = []
        for k, d in sorted(g.items(), key=lambda kv: (-kv[1]["cost_2024_meur"], str(kv[0]))):
            out.append({"key": k, **{kk: (clean(vv, 3) if isinstance(vv, float) else vv) for kk, vv in d.items()}})
        return out

    by_tax = agg(lambda r: r["tax"])
    by_cat = agg(lambda r: r["category"])
    by_benef = agg(lambda r: r["beneficiaries"]["type"])
    by_supp = agg(lambda r: r["resolution"]["suppression_code"] or "sans objet")
    assert sum(x["count"] for x in by_tax) == 465
    assert {x["key"]: x["count"] for x in by_tax} == {
        "Impôt sur le revenu": 170, "Impôt sur le revenu et impôt sur les sociétés": 53, "Droits d'enregistrement et de timbre": 50, "Taxe sur la valeur ajoutée": 46,
        "Impôts locaux": 42, "Impôt sur les sociétés": 38, "Accise sur les énergies": 37, "Autres droits": 23, "Autres impôts directs": 6}

    eteint_sum = clean(sum(r["cost_2024_meur"] or 0 for r in recs if r["eteint_avant_2025"]), 3)
    assert sum(1 for r in recs if r["eteint_avant_2025"]) == 47 and eteint_sum == clean(sy.num("D9") * 1000, 3), eteint_sum
    fin25 = [r for r in recs if r["eteint_fin_2025"]]
    fin25_sum = clean(sum(r["cost_2024_meur"] or 0 for r in fin25), 3)
    fin25_sum_tva = clean(sum(r["resolution"]["cost_2024_avec_tva_apu_meur"] or 0 for r in fin25), 3)
    assert len(fin25) == 35

    # --- provisions déclassées (modalités de calcul de l'impôt)
    mo = Sheet.get("niches", "Modalit_s_de_calcul_de_l_imp_t")
    prov = []
    for r in _rows(mo, 3):
        i = _idstr(r[3])
        label = ws(r[4])
        tax = ws(r[0])
        subcat = ws(r[1])
        costs = [_cost(r[6]), _cost(r[7]), _cost(r[8])]
        flags = {y: fl for y, (v, fl) in zip(("2024", "2025", "2026"), costs) if fl}
        kind = reason = None
        if i in HOUSEHOLD_EDITORIAL:
            kind, reason = HOUSEHOLD_EDITORIAL[i]
            reason = "liste éditoriale : " + reason
        prov.append({
            "id": i, "tax": tax, "subcategory": subcat or None, "subsubcategory": ws(r[2]) or None, "label_fr": label,
            "declassement_year": _dates(r[5]),
            "cost_2024_meur": costs[0][0], "cost_2025_meur": costs[1][0], "cost_2026_meur": costs[2][0], "cost_flags": flags or None,
            "dates": {"creation": _dates(r[9]), "last_modified": _dates(r[10]), "fin_fait_generateur": _dates(r[11]), "fin_incidence_budgetaire": _dates(r[12]),
                      "suppression": _dates(r[13]), "motif_fr": ws(r[15]) or None},
            "legal_ref": {"code": ws(r[16]).replace("\xa0", " ") or None, "reference": ws(r[17]) or None},
            "household_common": kind is not None, "household_common_kind": kind, "household_common_reason": reason,
        })
    assert len(prov) == 81, len(prov)
    for k in HOUSEHOLD_EDITORIAL:
        assert k in ids_set or k in {p["id"] for p in prov}, f"editorial id {k} not found"

    # --- 21 reduced VAT rates (aggregate only)
    tva_n, tva_md = int(sy.num("C11")), clean(sy.num("D11"), 6)
    assert tva_n == 21

    # headline per-niche checks vs source-analysis
    by_id = {r["id"]: r for r in recs}
    assert by_id["110246"]["cost_2024_meur"] == 6420 and by_id["120401"]["cost_2024_meur"] == 4803
    assert by_id["110201"]["cost_2024_meur"] == 1990 and by_id["110203"]["cost_2024_meur"] == 1737
    assert [by_id[k]["cost_2024_meur"] for k in ("110110", "110102", "110104", "110103")] == [849, 674, 523, 493]
    assert by_id["140102"]["cost_2024_meur"] == 950
    dec = next(p for p in prov if p["id"] == "110306")
    assert (dec["cost_2024_meur"], dec["cost_2026_meur"]) == (7652, 7618)
    res150113 = next(p for p in prov if p["id"] == "150113")
    assert res150113["cost_2024_meur"] == 955

    top10 = sorted(recs, key=lambda r: -(r["cost_2024_meur"] or 0))[:10]

    # --- plan: the authors' column vs the text of PLF-P1 n° 1
    def _sum(rs):
        return clean(sum(r["cost_2024_meur"] or 0 for r in rs), 3)

    conflits = [r for r in recs if r["resolution"]["plan_conflit_classeur"]]
    inferees = [r for r in recs if r["resolution"]["plan_lecture_inferee"]]
    by_groupe = collections.Counter(r["resolution"]["plan_texte"]["groupe"] for r in recs)
    by_final = collections.Counter(r["resolution"]["plan_final"] for r in recs)
    grp = lambda r: r["resolution"]["plan_texte"]["groupe"]  # noqa: E731
    assert {r["id"] for r in recs if grp(r) == "E" and r["resolution"]["plan_classeur"] != "eteinte"} >= {
        "300101", "300102", "60102", "60104", "120147", "300110", "300208", "530208", "60202", "300109", "500101", "530216", "110203", "110246"}, "IV.E niches"
    assert by_id["520110"]["resolution"]["plan_texte"]["groupe"] == "Cbis" and by_id["520110"]["resolution"]["plan_final"] == "supprimee"  # Pacte Dutreil: 1er janvier 2027
    c_ir = [r for r in recs if grp(r) == "C" and r["tax"].startswith("Impôt sur le revenu")]
    assert {"110102", "110103", "110107", "100202", "140122", "150114", "150117", "150120", "150515", "150518", "190208", "150121", "150210", "150211", "150406", "150705", "150706", "150707", "150710"} <= {r["id"] for r in c_ir}
    # M3, M4, open items 2 and 3
    assert (by_id["110240"]["resolution"]["plan_final"], grp(by_id["110240"])) == ("trois-ans", "E8")
    assert (by_id["120124"]["resolution"]["plan_final"], grp(by_id["120124"])) == ("supprimee", "A")
    assert (by_id["60203"]["resolution"]["plan_final"], grp(by_id["60203"])) == ("trois-ans", "E") and by_id["60203"]["resolution"]["plan_texte"]["inferred"]
    assert by_id["110203"]["resolution"]["plan_texte"]["inferred"] and by_id["110203"]["resolution"]["plan_final"] == "trois-ans"

    # TVA : lecture de PLF-P1 n° 1 (II 4°, III bis, IV.D) sur les 46 niches de TVA
    tva = [r for r in recs if r["tax"] == "Taxe sur la valeur ajoutée"]
    assert len(tva) == 46
    tva_parts = {
        "nommees_iii_bis": [r for r in tva if grp(r) == "D3bis"],
        "partiellement_nommees": [r for r in tva if grp(r) == "D3bisPart"],
        "taux_non_nommes_maintenus": [r for r in tva if grp(r) == "Dmaint"],
        "exonerations_regle_generale": [r for r in tva if r["id"] in TVA_REGLE_GENERALE],
        "outre_mer_hors_champ": [r for r in tva if r["id"] in HORS_CHAMP_OM],
        "outre_mer_flux_om": [r for r in tva if r["resolution"]["suppression_code"] == "Flux OM"],
        "deja_eteintes": [r for r in tva if r["resolution"]["plan_classeur"] == "eteinte"],
    }
    assert {k: len(v) for k, v in tva_parts.items()} == {"nommees_iii_bis": 22, "partiellement_nommees": 2, "taux_non_nommes_maintenus": 6, "exonerations_regle_generale": 6,
                                                         "outre_mer_hors_champ": 2, "outre_mer_flux_om": 5, "deja_eteintes": 3}, {k: len(v) for k, v in tva_parts.items()}
    assert sum(len(v) for v in tva_parts.values()) == 46 and len({r["id"] for v in tva_parts.values() for r in v}) == 46
    om = [r for r in recs if grp(r) == "OM"]
    om_oui = [r for r in om if r["resolution"]["plan_classeur"] == "supprimee"]
    assert len(om) == 16 and len(om_oui) == 10 and {r["id"] for r in om_oui} == HORS_CHAMP_OM, (len(om), len(om_oui))
    assert all(r["category"] != "outre-mer" for r in tva if r["id"] == "730224")  # m6 : « réunions sportives » n'est pas la Réunion
    plan_texte = {
        "source": _group_sources(),
        "note_fr": "Lecture du texte de PLF-P1 n° 1 : le III abroge les dispositions numéro par numéro, le IV donne un calendrier à chaque groupe de numéros. Chaque niche est rapprochée des numéros du III par sa référence légale (article et alinéa) ; quand les numéros rapprochés relèvent de plusieurs groupes, ou quand aucun ne la cite, aucune date n'est affirmée (groupe null). Pour la TVA, le III bis supprime des lignes de taux au 1er juillet 2027 et le II, 4° maintient les autres taux réduits ou dérogatoires ; pour l'outre-mer, le II (dernier alinéa) met les dispositions propres aux collectivités des articles 73 et 74 hors du I et du III. Le classeur des auteurs (colonne « Suppression ») donne une autre lecture pour certaines niches : elles sont listées dans conflits_avec_le_classeur ; plan_final suit le texte.",
        "groupes": {str(g): {"n_niches": by_groupe.get(g, 0), "cout_2024_meur": _sum([r for r in recs if grp(r) == g])} for g in list(GROUPS_FR) + [None]},
        "plan_final": {k: {"n_niches": v, "cout_2024_meur": _sum([r for r in recs if r["resolution"]["plan_final"] == k])} for k, v in sorted(by_final.items())},
        "conflits_avec_le_classeur": [{"id": r["id"], "label_fr": r["label_fr"], "cout_2024_meur": r["cost_2024_meur"], "plan_classeur": r["resolution"]["plan_classeur"], "plan_final": r["resolution"]["plan_final"],
                                       "groupe": grp(r), "inferred": r["resolution"]["plan_texte"]["inferred"]} for r in conflits],
        "lectures_inferees": [{"id": r["id"], "label_fr": r["label_fr"], "cout_2024_meur": r["cost_2024_meur"], "groupe": grp(r), "plan_final": r["resolution"]["plan_final"]} for r in inferees],
        "ir_2028": {"n_niches": len(c_ir), "cout_2024_meur": _sum(c_ir), "note_fr": "Niches de l'impôt sur le revenu dont l'abrogation s'applique à l'impôt dû au titre de 2028 (IV.C), et non dès 2027."},
        "tva": {
            "n_niches": len(tva), "cout_2024_meur": _sum(tva),
            **{k: {"n_niches": len(v), "cout_2024_meur": _sum(v), "ids": [r["id"] for r in v]} for k, v in tva_parts.items()},
            "note_fr": "Lecture par l'intitulé : la correspondance entre les articles du code général des impôts et les lignes du code des impositions sur les biens et services (III bis) n'est pas dans les sources du dépôt. Le II, 4° ne laisse hors du I que les taux réduits ou dérogatoires « à l'exception de celles que le III abroge » ; les 21 numéros du III bis sont les seules lignes de taux supprimées au 1er juillet 2027. Les exposés des n° 1 et 21 annoncent davantage (conflit texte et exposé, non tranché).",
            "conflit_expose": {"n_niches": len(tva_parts["taux_non_nommes_maintenus"]) + len(tva_parts["partiellement_nommees"]),
                               "ids": [r["id"] for r in tva_parts["taux_non_nommes_maintenus"] + tva_parts["partiellement_nommees"]],
                               "citation_expose_21": "Les taux dérogatoires recensés comme dépenses fiscales ne sont pas visés ici : une disposition distincte les supprime au 1er juillet 2027.",
                               "citation_texte_ii_4": "Qui fixent un taux réduit ou dérogatoire de taxe sur la valeur ajoutée, à l’exception de celles que le III abroge."},
        },
        "outre_mer": {
            "hors_champ": {"n_niches": len(om), "cout_2024_meur": _sum(om), "dont_oui_au_classeur": {"n_niches": len(om_oui), "cout_2024_meur": _sum(om_oui), "ids": sorted(r["id"] for r in om_oui)}},
            "investissements_dans_le_champ": sorted(DANS_LE_CHAMP_OM | {"110210", "110224", "110256", "320136", "320146"}),
            "note_fr": "II, dernier alinéa : « Ne relèvent pas du I et du III les dispositions propres aux collectivités régies par l’article 73 ou par l’article 74 de la Constitution et à la Nouvelle-Calédonie, qui sont régies par un régime fiscal distinct. Le présent alinéa ne s’applique pas aux dispositions dont le bénéfice est accordé à une personne qui n’est pas domiciliée dans ces collectivités. »",
        },
    }

    return {
        "meta": {
            "title_fr": "Les 465 niches fiscales recensées au PLF 2026",
            "source": sy.source("A1:D14") | {"also": [cr.ref("A5:Q471"), ch.ref("A3:H469"), ec.ref(), be.ref(), ex.ref(), me.ref(), rj.ref(), pr.ref()],
                                            "origin": "PLF 2026, Évaluation des voies et moyens, tome II, annexe 3 — Dépenses fiscales"},
            "origin_url": "https://www.budget.gouv.fr/documentation/documents-budgetaires-lois/exercice-2026/plf-2026",
            "tier": "donnee",
            "units": {"cost_*_meur": "millions d'euros (M€) : 2024 réalisé, 2025 prévision de réalisation, 2026 prévision"},
            "counts": {"niches": 465, "provisions_calcul_impot": 81, "taux_reduits_tva_hors_niches": 21, "total_niches_et_taux_reduits": int(sy.num("C12"))},
            "totals": {"cost_2024_meur": total24, "cost_2025_meur": total25, "cost_2026_meur": total26,
                       "cost_2024_avec_tva_apu_meur": clean(sy.num("D8") * 1000, 3), "total_486_cost_2024_meur": clean(sy.num("D12") * 1000, 3)},
            "cost_markers": {"aucun_effet": "« - » : aucun effet budgétaire", "epsilon": "« ε » : moins de 0,5 M€, non calculé", "nc": "« nc » : non calculé"},
            "non_determine_beneficiaries": "« Non déterminé » dans la source → count = null et count_flag = non_determine.",
            "category_rule": "1 catégorie par niche, première règle qui s'applique : outre-mer > TVA > épargne > logement > ménages | entreprises (selon la nature des bénéficiaires) > autre ; category_tags liste toutes les règles qui s'appliquent. Les expressions régulières sont dans pipeline/b_niches.py.",
            "household_common_rule": f"household_common = vrai si l'id figure dans la liste éditoriale (emploi à domicile, garde d'enfants, abattement 10 % pensions, dons, demi-parts, décote, livrets, assurance-vie, PEA, épargne salariale, heures supplémentaires, titres-restaurant, TVA des travaux et de la restauration…) OU si la nature des bénéficiaires est « Ménages » avec au moins 1 000 000 de bénéficiaires. household_common_kind : beneficiaire_direct | prix_consommation (TVA payée via les prix).",
            "typologie_se": "Colonne « S / E » du classeur, sans légende : S regroupe 16 exonérations salariales (somme des gages = 4,80 Md€ = « dont exonérations salariales » de Détail Niches) ; E regroupe 12 exonérations d'épargne et de produits financiers (somme des gages = 2,75 Md€). Interprétation par recoupement, non écrite dans le classeur.",
            "eteint": {
                "avant_2025": {"nombre": 47, "cout_2024_meur": eteint_sum, "regle": "fin du fait générateur ≤ 2024 (= 47 niches, 3,775 Md€ de la feuille Synthèse)"},
                "fin_2025": {"nombre": 35, "cout_2024_meur": fin25_sum, "cout_2024_avec_tva_apu_meur": fin25_sum_tva,
                             "regle": "fin du fait générateur = 2025 (35 niches) ; la feuille Synthèse indique 1,2987 Md€ pour ce groupe, contre " + f"{fin25_sum:g} M€ en réalisation 2024 dans Chiffrages Résolution (écart documenté dans DISCREPANCIES.md)"},
                "suppression_sans_objet": "les 82 lignes sans code de suppression sont exactement celles dont le fait générateur s'éteint en 2025 ou avant",
            },
        },
        "plan_texte": plan_texte,
        "niches": recs,
        "provisions_calcul_impot": prov,
        "taux_reduits_tva_hors_niches": {
            "count": tva_n, "cost_2024_meur": clean(tva_md * 1000, 3), "cost_2024_md": tva_md,
            "estimation": "Estimation du CPO (février 2023, p. 32), projetée sur 2024 au prorata de la TVA dans les comptes nationaux de l'Insee par les auteurs : 30 Md€ en 2021 dont 20 Md€ sur l'eau et l'alimentation. Ce n'est pas un chiffre de l'annexe du PLF (qui ne compte pas ces 21 taux comme dépenses fiscales).",
            "tier": "annonce",
            "liste_individuelle": None,
            "liste_note": "Les sources du dépôt ne publient pas la liste des 21 taux réduits (seulement leur nombre et leur coût agrégé) ; les taux visés par l'amendement PLF-P1 n° 21 sont 10 %, 5,5 % et 2,1 % (alimentation : 10 % au 1er juillet 2028, 15 % en 2029, 20 % en 2030).",
            "source": sy.source("B11:D14"),
        },
        "synthese": {
            "par_impot": by_tax, "par_categorie": by_cat, "par_beneficiaires": by_benef, "par_suppression": by_supp,
            "top10_cout_2024": [{"id": r["id"], "label_fr": r["label_fr"], "cost_2024_meur": r["cost_2024_meur"], "category": r["category"]} for r in top10],
            "household_common": {"count": sum(1 for r in recs if r["household_common"]),
                                 "cost_2024_meur": clean(sum(r["cost_2024_meur"] or 0 for r in recs if r["household_common"]), 3),
                                 "editorial_ids_in_465": sorted(editorial_in_465),
                                 "editorial_ids_in_provisions": sorted(k for k in HOUSEHOLD_EDITORIAL if k not in ids_set)},
            "cout_2026_vs_exposé": {"somme_lignes_2026_meur": total26, "exposé_plf_p1_1_md": 79.5,
                                    "note": "L'exposé de PLF-P1 n° 1 cite « un coût prévisionnel de 79,5 milliards d'euros en 2026 » ; la somme des 465 lignes 2026 du classeur vaut 79,613 Md€ (ε et nc comptés pour 0)."},
        },
    }
