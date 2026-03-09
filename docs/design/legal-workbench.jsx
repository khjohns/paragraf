import { useState, useCallback, useMemo, useRef, useEffect } from "react";

/* ═══════════════════════════ DESIGN TOKENS ═══════════════════════════ */
const T = {
  bg:'#F5F3EE', panel:'#FAF9F6', surface:'#FFFFFF', input:'#EFECE5',
  hover:'rgba(26,24,20,0.03)', active:'rgba(26,24,20,0.06)',
  ink:'#1A1814', ink2:'#5C564D', ink3:'#8C8578', ink4:'#B0A99E',
  border:'rgba(26,24,20,0.08)', borderM:'rgba(26,24,20,0.13)', borderS:'rgba(26,24,20,0.22)',
  prov:{bg:'#E8EEF0',accent:'#4A6670',border:'#C5D3D8',label:'Bestemmelse'},
  kofa:{bg:'#F0EBD8',accent:'#8B6914',border:'#DDD3B0',label:'KOFA-sak'},
  eu:{bg:'#E4F0EC',accent:'#2D6A5D',border:'#BDD9CF',label:'EU-dom'},
  court:{bg:'#EDE4EE',accent:'#6B4C6E',border:'#D4C4D6',label:'Rettsavgjørelse'},
  prep:{bg:'#EDE8E0',accent:'#7A6B5D',border:'#D5CEC3',label:'Forarbeid'},
  success:'#3D7A4A', successBg:'#EBF5ED',
  warn:'#A67B2E', warnBg:'#FBF5E8',
  danger:'#A63D3D', dangerBg:'#F5EBEB',
  gap:'#9B4DCA', gapBg:'#F3ECF8',
  delim:'#C4650A', delimBg:'#FDF2E7',
  signalOn:'#1A1814', signalOff:'#D5D0C8',
  aiAccent:'#8B6914', aiCommentBg:'rgba(139,105,20,0.04)', aiCommentBorder:'rgba(139,105,20,0.25)', highlight:'#FBF5E8',
};
const nc = t => ({provision:T.prov,kofa_case:T.kofa,eu_case:T.eu,court_case:T.court,prep_work:T.prep}[t]||T.kofa);

/* ═══════════════════════════ MOCK DATA ═══════════════════════════ */
const PROBLEM = 'Er ESPD fra støttende virksomhet tilstrekkelig til å dokumentere rådighet over dennes ressurser, eller må forpliktelseserklæring foreligge ved tilbudsfrist?';
const SEEDS = {provisions:['FOA §16-10','FOA §17-1'],fts:['forpliktelseserklæring','støttende virksomhet'],vector:'Krav til dokumentasjon av rådighet over støttende virksomhets kapasitet'};

const NODES = [
  {id:'p1',type:'provision',label:'FOA §16-10',subtitle:'Bruk av andre enheters kapasitet',isSeed:true,detail:'Oppdragsgiver kan stille krav om at leverandøren dokumenterer at han faktisk råder over nødvendige ressurser, for eksempel ved å legge frem en forpliktelseserklæring fra disse enhetene.',connectedTo:['c1','c2','c3','c4','c5','c6','c7','c8','eu1','eu2','fw1'],regulation:'new'},
  {id:'p2',type:'provision',label:'FOA §17-1',subtitle:'Dokumentasjonskrav',isSeed:true,detail:'Oppdragsgiver skal angi i anskaffelsesdokumentene hvilke kvalifikasjonskrav leverandøren må oppfylle og hvilken dokumentasjon som skal leveres.',connectedTo:['c1','c2','c4','fw1'],regulation:'new'},
  {id:'p3',type:'provision',label:'FOA §16-12',subtitle:'Avvisning grunnet støttende virksomhet',detail:'Oppdragsgiver skal kreve at leverandøren bytter ut en støttende virksomhet som det foreligger avvisningsgrunn mot.',connectedTo:['c3','c5'],regulation:'new'},
  {id:'p4',type:'provision',label:'LOA §5',subtitle:'Grunnleggende krav',detail:'Oppdragsgiver skal opptre i samsvar med grunnleggende prinsipper om konkurranse, likebehandling, forutberegnelighet, etterprøvbarhet og forholdsmessighet.',connectedTo:['c2','c6'],regulation:'new'},
  {id:'p5',type:'provision',label:'FOA §16-3',subtitle:'Økonomisk og finansiell stilling',detail:'Oppdragsgiver kan stille krav til leverandørens økonomiske og finansielle stilling.',connectedTo:[],regulation:'new'},
  {id:'c1',type:'kofa_case',label:'2023/456',subtitle:'ESPD + støttende virksomhet',date:'2023-06-15',outcome:'Brudd',category:'A',signals:{ref:true,fts:true,vec:true},citations:3,regulation:'new',iteration:1,detail:'Innklagede avviste klagers tilbud fordi ESPD fra støttende virksomhet ikke var vedlagt. Nemnda fant at forpliktelseserklæring måtte foreligge ved tilbudsfristen.',connectedTo:['p1','p2','eu1','c2','c4'],valence:{c2:'confirming',c4:'distinguishing'}},
  {id:'c2',type:'kofa_case',label:'2022/789',subtitle:'Forpliktelseserklæring — tidspunkt',date:'2022-11-22',outcome:'Ikke brudd',category:'A',signals:{ref:true,fts:true,vec:true},citations:7,regulation:'new',iteration:1,detail:'Spørsmål om forpliktelseserklæring kunne ettersendes. Nemnda konkluderte med at kravet kan oppfylles etter tilbudsfrist dersom tilbudet inneholder tilstrekkelig dokumentasjon.',connectedTo:['p1','p2','p4','c1','c4','eu2'],valence:{c1:'confirming',c4:'confirming'}},
  {id:'c3',type:'kofa_case',label:'2021/234',subtitle:'Kvantitativ kapasitet',date:'2021-08-03',outcome:'Brudd',category:'B',signals:{ref:true,fts:true,vec:false},citations:2,regulation:'new',iteration:1,detail:'Saken gjaldt krav til kvantitativ bemanning via støttende virksomhet.',connectedTo:['p1','p3','c5'],valence:{c5:'confirming'}},
  {id:'c4',type:'kofa_case',label:'2020/567',subtitle:'Underleverandør vs. støttende',date:'2020-03-18',outcome:'Ikke brudd',category:'B',signals:{ref:true,fts:false,vec:true},citations:5,regulation:'new',iteration:1,detail:'Nemnda avklarte skillet mellom underleverandør og støttende virksomhet.',connectedTo:['p1','p2','c1','c2'],valence:{c1:'distinguishing',c2:'confirming'}},
  {id:'c5',type:'kofa_case',label:'2019/890',subtitle:'§16-10 ikke anvendelig',date:'2019-12-01',outcome:'Avvist',category:'C',signals:{ref:false,fts:true,vec:false},citations:0,regulation:'new',iteration:1,isDelimitation:true,detail:'Klager anførte brudd på §16-10. Nemnda fant at bestemmelsen ikke var relevant. Avgrensningspraksis.',connectedTo:['p1','p3']},
  {id:'c6',type:'kofa_case',label:'2018/123',subtitle:'Rådighet og likebehandling',date:'2018-05-20',outcome:'Brudd',category:'A',signals:{ref:true,fts:true,vec:true},citations:12,regulation:'new',iteration:1,detail:'Prinsipiell avgjørelse om forholdet mellom §16-10 og likebehandlingsprinsippet. Sitert i 12 etterfølgende saker.',connectedTo:['p1','p4','eu1','eu2','c1','c2','c7']},
  {id:'c7',type:'kofa_case',label:'2022/345',subtitle:'Binær vs. kvantitativ rådighet',date:'2022-04-12',outcome:'Brudd',category:'B',signals:{ref:true,fts:false,vec:true},citations:1,regulation:'new',iteration:2,detail:'Introduserer skillet mellom binær rådighet (ja/nei) og kvantitativ rådighet (gradsbestemt).',connectedTo:['p1','c3','c6'],valence:{c6:'confirming',c3:'distinguishing'}},
  {id:'c8',type:'kofa_case',label:'2017/678',subtitle:'Gammel FOA — støttende',date:'2017-02-14',outcome:'Brudd',category:'C',signals:{ref:false,fts:true,vec:false},citations:1,regulation:'old',iteration:1,isDelimitation:true,detail:'Avgjørelse under gammel FOA. Praksis kan ikke uten videre overføres.',connectedTo:['p1']},
  {id:'eu1',type:'eu_case',label:'C-324/14',subtitle:'Partner Apelski',date:'2016-05-10',category:'A',signals:{ref:true,fts:false,vec:true},citations:8,iteration:1,detail:'EU-domstolen presiserte kravene til dokumentasjon av rådighet over støttende virksomhets ressurser under direktiv 2014/24/EU art. 63.',directive:'Art. 63',connectedTo:['p1','c1','c6']},
  {id:'eu2',type:'eu_case',label:'C-601/13',subtitle:'Ambisig',date:'2014-10-07',category:'B',signals:{ref:true,fts:false,vec:false},citations:4,iteration:1,detail:'Avgjørelse om støttende virksomhets kvalifikasjoner og dokumentasjonskrav.',directive:'Art. 58 + 63',connectedTo:['p1','c2','c6','eu1']},
  {id:'fw1',type:'prep_work',label:'Prop. 51 L',subtitle:'Til anskaffelsesloven (2015–2016)',detail:'Forarbeidene drøfter gjennomføringen av direktiv 2014/24/EU art. 63 i norsk rett.',connectedTo:['p1','p2']},
];

const EDGES = [];
NODES.forEach(n => { (n.connectedTo||[]).forEach(t => { if (!EDGES.find(e=>(e.from===n.id&&e.to===t)||(e.from===t&&e.to===n.id))) { const v = n.valence?.[t]||NODES.find(x=>x.id===t)?.valence?.[n.id]||'unknown'; EDGES.push({from:n.id,to:t,valence:v}); } }); });

const GAP_MATRIX = [
  {p1:'FOA §16-10',p2:'FOA §17-1',count:3},{p1:'FOA §16-10',p2:'FOA §16-12',count:2},
  {p1:'FOA §16-10',p2:'LOA §5',count:2},{p1:'FOA §16-10',p2:'FOA §16-3',count:0},
  {p1:'FOA §17-1',p2:'FOA §16-12',count:0},{p1:'FOA §17-1',p2:'LOA §5',count:1},
  {p1:'FOA §17-1',p2:'FOA §16-3',count:0},{p1:'FOA §16-12',p2:'LOA §5',count:0},
];

/* ── Decision text paragraphs (mock database content) ── */
const DECISION_TEXT = {
  'c1': [
    {p:35,text:'Saken gjelder klage over innklagedes beslutning om å avvise klagers tilbud i en åpen anbudskonkurranse om rammeavtale for konsulenttjenester innen IT-drift og -utvikling.'},
    {p:36,text:'Klager hadde i sitt tilbud oppgitt Firma X AS som støttende virksomhet for å oppfylle kvalifikasjonskravet om relevant erfaring fra tilsvarende oppdrag.'},
    {p:37,text:'Klager vedla ESPD-skjema utfylt av Firma X AS som dokumentasjon på at den støttende virksomheten oppfylte kvalifikasjonskravene. Det ble ikke vedlagt en separat forpliktelseserklæring.'},
    {p:38,text:'Innklagede avviste tilbudet under henvisning til at ESPD fra støttende virksomhet ikke er tilstrekkelig dokumentasjon på at leverandøren faktisk råder over den støttende virksomhetens ressurser.'},
    {p:39,text:'Spørsmålet for nemnda er om innklagede hadde rettslig grunnlag for å avvise klagers tilbud på dette grunnlaget, herunder om ESPD-skjema fra en støttende virksomhet alene oppfyller dokumentasjonskravet i FOA § 16-10.'},
    {p:40,text:'FOA § 16-10 første ledd fastslår at en leverandør kan støtte seg på andre enheters kapasitet for å oppfylle kvalifikasjonskrav. Det følger av bestemmelsens annet ledd at oppdragsgiver i så fall kan kreve dokumentasjon på at leverandøren faktisk råder over de nødvendige ressursene.'},
    {p:41,text:'Bestemmelsen gjennomfører direktiv 2014/24/EU artikkel 63, som presiserer at den økonomiske aktøren skal bevise at den vil ha de nødvendige ressursene til rådighet, for eksempel ved å legge frem en tilsvarende forpliktelse fra disse enhetene.'},
    {p:42,text:'Nemnda finner at kravet til forpliktelseserklæring må foreligge ved tilbudsfristen. Et ESPD-skjema fra den støttende virksomheten dokumenterer at virksomheten oppfyller kvalifikasjonskravene, men det dokumenterer ikke at leverandøren faktisk råder over virksomhetens ressurser. Det er to ulike spørsmål.'},
    {p:43,text:'ESPD-skjemaet er en egenerklæring om at den støttende virksomheten selv oppfyller visse krav. Forpliktelseserklæringen er en erklæring om at den støttende virksomheten stiller sine ressurser til disposisjon for leverandøren. Disse dokumentene har ulike funksjoner og det ene kan ikke erstatte det andre.'},
    {p:44,text:'Nemnda viser i denne sammenheng til EU-domstolens avgjørelse i sak C-324/14 (Partner Apelski), der domstolen presiserte at den økonomiske aktøren må dokumentere at den faktisk disponerer over de ressursene som tilhører de enhetene den støtter seg på.'},
    {p:45,text:'Klagers anførsel om at avvisningen var uforholdsmessig, kan ikke føre frem. Kravet om forpliktelseserklæring er et grunnleggende dokumentasjonskrav som skal sikre at oppdragsgiver kan verifisere at leverandøren faktisk har tilgang til de ressursene som er nødvendige for kontraktsgjennomføringen.'},
    {p:46,text:'Innklagede hadde etter dette rettslig grunnlag for å avvise klagers tilbud. Klagen har ikke ført frem.'},
  ],
  'c2': [
    {p:33,text:'Saken gjelder klage over innklagedes beslutning om tildeling av kontrakt for prosjektering av nytt administrasjonsbygg.'},
    {p:34,text:'Klager anfører at valgte leverandør ikke hadde vedlagt forpliktelseserklæring fra sin støttende virksomhet ved tilbudsfristens utløp, og at tilbudet derfor skulle vært avvist.'},
    {p:35,text:'Det er uomtvistet at valgte leverandør støttet seg på Ingeniørfirma Y AS for å oppfylle kvalifikasjonskravet om prosjekteringskompetanse. Forpliktelseserklæring ble ettersendt tre dager etter tilbudsfristen, etter forespørsel fra innklagede.'},
    {p:36,text:'Spørsmålet for nemnda er om innklagede hadde adgang til å tillate ettersending av forpliktelseserklæringen, eller om dokumentet måtte foreligge ved tilbudsfristen.'},
    {p:37,text:'Nemnda bemerker at FOA § 16-10 ikke eksplisitt regulerer tidspunktet for fremleggelse av forpliktelseserklæring. Bestemmelsen fastslår at oppdragsgiver «kan kreve» slik dokumentasjon, men angir ikke at den må foreligge ved tilbudsfristen.'},
    {p:38,text:'Nemnda finner at forpliktelseserklæring kan ettersendes dersom tilbudet for øvrig inneholder tilstrekkelig informasjon til at oppdragsgiver kan vurdere om kvalifikasjonskravet er oppfylt. I denne saken inneholdt tilbudet en detaljert beskrivelse av samarbeidet med den støttende virksomheten, samt kontaktinformasjon og referanser.'},
    {p:39,text:'Nemnda presiserer at dette ikke innebærer at forpliktelseserklæring generelt kan utelates ved tilbudsfristen. Vurderingen beror på en konkret helhetsvurdering av om tilbudet gir tilstrekkelig grunnlag for å vurdere leverandørens rådighet over den støttende virksomhetens ressurser.'},
    {p:40,text:'Under denne konkrete helhetsvurderingen legger nemnda vekt på at valgte leverandør hadde vedlagt utfyllende dokumentasjon om samarbeidet, herunder tidligere felles prosjekter og en intensjonsavtale. Den manglende forpliktelseserklæringen var således den eneste formelle mangelen.'},
    {p:41,text:'Innklagede hadde etter dette adgang til å tillate ettersending av forpliktelseserklæringen. Klagen har ikke ført frem.'},
  ],
};

const AI_CURATION = {
  'c1': {
    highlights: [
      {p:42,ranges:[[0,250]],relevance:'Sentralt: ESPD ≠ forpliktelseserklæring'},
      {p:43,ranges:[[0,230]],relevance:'Funksjonsforskjell mellom dokumenttypene'},
      {p:44,ranges:[[0,210]],relevance:'EU-forankring via C-324/14'},
    ],
    comments: [
      {afterParagraph:42,text:'Nemnda skiller mellom to spørsmål: (1) oppfyller støttende virksomhet kvalifikasjonskravene? og (2) råder leverandøren over ressursene? ESPD besvarer kun spørsmål 1.',
        crossRef:{caseId:'c2',paragraph:38,label:'2022/789 §38',note:'Motstridende: ettersending akseptert'}},
      {afterParagraph:44,text:'EU-forankringen styrker argumentet. Partner Apelski krever dokumentasjon av faktisk disposisjonsrett.',
        crossRef:{caseId:'eu1',label:'C-324/14',note:'Premiss om «faktisk disponerer»'}},
    ],
  },
  'c2': {
    highlights: [
      {p:37,ranges:[[0,195]],relevance:'Lovtolkning: tidspunkt ikke eksplisitt regulert'},
      {p:38,ranges:[[0,290]],relevance:'Sentral rettssetning: ettersending under vilkår'},
      {p:39,ranges:[[0,260]],relevance:'Viktig presisering — ikke generell regel'},
    ],
    comments: [
      {afterParagraph:38,text:'Står i spenning med 2023/456 som krever forpliktelseserklæring ved tilbudsfrist. Forskjellen kan ligge i «tilstrekkelig informasjon» utover ESPD.',
        crossRef:{caseId:'c1',paragraph:42,label:'2023/456 §42',note:'Motstridende: krav ved tilbudsfrist'}},
      {afterParagraph:39,text:'Presiseringen reduserer motstriden noe — nemnda åpner ikke for generell utelatelse. Vilkåret er «konkret helhetsvurdering».'},
    ],
  },
};

/* ═══════════════════════════ MICRO COMPONENTS ═══════════════════════════ */
function SignalDots({signals, size=6}) {
  if (!signals) return null;
  return (
    <div style={{display:'flex',alignItems:'center',gap:3}} title="R: Referansetabell  F: Fulltekst  V: Vektor">
      {['ref','fts','vec'].map(k => (
        <div key={k} style={{width:size,height:size,borderRadius:'50%',background:signals[k]?T.signalOn:'transparent',border:`1.5px solid ${signals[k]?T.signalOn:T.signalOff}`}} />
      ))}
    </div>
  );
}

function CategoryBadge({category, small}) {
  if (!category) return null;
  const c = {A:{bg:'rgba(26,24,20,0.08)',text:T.ink},B:{bg:'rgba(26,24,20,0.05)',text:T.ink2},C:{bg:'rgba(26,24,20,0.03)',text:T.ink3}}[category] || {bg:'rgba(26,24,20,0.03)',text:T.ink3};
  return (<span style={{display:'inline-flex',fontSize:small?10:11,fontWeight:600,letterSpacing:'0.03em',padding:small?'1px 4px':'2px 6px',borderRadius:3,background:c.bg,color:c.text}}>{category}</span>);
}

function DelimBadge() {
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:600,padding:'2px 6px',borderRadius:3,background:T.delimBg,color:T.delim,border:`1px solid rgba(196,101,10,0.12)`}}>
      <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.5" stroke={T.delim} strokeWidth="1.2" fill="none"/><line x1="3" y1="3" x2="7" y2="7" stroke={T.delim} strokeWidth="1.2"/></svg>
      Avgrensning
    </span>
  );
}

function NodeTypeIcon({type, size=14}) {
  const c = nc(type);
  const s = {display:'inline-block',flexShrink:0};
  if (type==='provision') return (<div style={{...s,width:size,height:size*0.7,borderRadius:2,background:c.accent,opacity:0.8}} />);
  if (type==='kofa_case') return (<div style={{...s,width:size,height:size,borderRadius:'50%',background:c.accent,opacity:0.8}} />);
  if (type==='eu_case') return (<div style={{...s,width:size*0.85,height:size*0.85,background:c.accent,opacity:0.8,transform:'rotate(45deg)',borderRadius:2}} />);
  if (type==='prep_work') return (<div style={{...s,width:size,height:size*0.8,borderRadius:2,background:c.accent,opacity:0.5}} />);
  return null;
}

function ValencePip({valence, size=10}) {
  if (!valence || valence==='unknown') return null;
  const cfg = {confirming:{color:T.success,icon:'✓',label:'Bekreftende'},distinguishing:{color:T.warn,icon:'↔',label:'Avgrensende'},departing:{color:T.danger,icon:'✕',label:'Fravikende'}};
  const v = cfg[valence];
  if (!v) return null;
  return (<span title={v.label} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:size+6,height:size+4,borderRadius:3,fontSize:size-1,fontWeight:700,color:v.color,background:valence==='distinguishing'?T.warnBg:valence==='departing'?T.dangerBg:T.successBg}}>{v.icon}</span>);
}

/* ═══════════════════════════ LEFT PANEL ═══════════════════════════ */
function LeftPanel({iteration, onNewIteration, readNodes}) {
  const [expanded, setExpanded] = useState({0:true,1:false,2:true,3:true,4:false});
  const toggle = i => setExpanded(p => ({...p,[i]:!p[i]}));
  const cases = NODES.filter(n => n.category);
  const counts = {A:cases.filter(n=>n.category==='A').length, B:cases.filter(n=>n.category==='B').length, C:cases.filter(n=>n.category==='C').length, total:cases.length};
  const delimCount = NODES.filter(n => n.isDelimitation).length;
  const readCount = cat => cases.filter(n => n.category===cat && readNodes.has(n.id)).length;
  const gaps = GAP_MATRIX.filter(g => g.count===0);

  const Section = ({num,title,subtitle,idx,children,badge}) => (
    <div style={{borderBottom:`1px solid ${T.border}`}}>
      <button onClick={() => toggle(idx)} style={{width:'100%',padding:'10px 16px',display:'flex',alignItems:'center',gap:8,background:'transparent',border:'none',cursor:'pointer',textAlign:'left'}}>
        <span style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0,background:expanded[idx]?T.ink:'transparent',color:expanded[idx]?T.panel:T.ink,border:`1.5px solid ${expanded[idx]?T.ink:T.borderS}`,transition:'all 0.15s ease'}}>{num}</span>
        <span style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:T.ink}}>{title}</span>{subtitle && <span style={{fontSize:11,color:T.ink3,marginLeft:6}}>{subtitle}</span>}</span>
        {badge}
        <svg width="12" height="12" viewBox="0 0 12 12" style={{transform:expanded[idx]?'rotate(0)':'rotate(-90deg)',transition:'transform 0.15s ease',opacity:0.4}}><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
      </button>
      {expanded[idx] && <div style={{padding:'0 16px 14px'}}>{children}</div>}
    </div>
  );

  return (
    <div style={{width:300,minWidth:300,height:'100%',background:T.panel,borderRight:`1px solid ${T.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'16px 16px 12px',borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:T.ink3,marginBottom:4}}>Rettskildeanalyse</div>
        <div style={{fontSize:14,fontWeight:600,color:T.ink}}>FOA §16-10 — Rådighet</div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
        <Section num="1" title="Problemstilling" idx={0}>
          <div style={{padding:'10px 12px',borderRadius:6,background:T.input,border:`1px solid ${T.border}`,fontSize:13,lineHeight:'1.55',color:T.ink}}>{PROBLEM}</div>
        </Section>
        <Section num="2" title="Utgangspunkt" idx={1}>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.05em',marginBottom:5,textTransform:'uppercase'}}>Bestemmelser</div><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{SEEDS.provisions.map(s => <span key={s} style={{fontSize:12,fontWeight:500,fontFamily:'monospace',padding:'3px 7px',borderRadius:4,background:T.input,border:`1px solid ${T.borderM}`,color:T.ink}}>{s}</span>)}</div></div>
            <div><div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.05em',marginBottom:5,textTransform:'uppercase'}}>FTS-begreper</div><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{SEEDS.fts.map(s => <span key={s} style={{fontSize:12,fontWeight:500,fontFamily:'monospace',padding:'3px 7px',borderRadius:4,background:T.input,border:`1px solid ${T.borderM}`,color:T.ink}}>{s}</span>)}</div></div>
            <div><div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.05em',marginBottom:5,textTransform:'uppercase'}}>Konseptuelt søk (vektor)</div><div style={{padding:'7px 10px',borderRadius:4,background:T.input,border:`1px solid ${T.border}`,fontSize:12,lineHeight:'1.5',color:T.ink2,fontStyle:'italic'}}>{SEEDS.vector}</div></div>
          </div>
        </Section>
        <Section num="3" title="Resultater" subtitle={`${counts.total} treff`} idx={2}>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {['A','B','C'].map(cat => (
              <div key={cat} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:5,background:T.surface,border:`1px solid ${T.border}`}}>
                <CategoryBadge category={cat} /><span style={{fontSize:12,color:T.ink2,flex:1}}>{cat==='A'?'Ref + FTS + Vektor':cat==='B'?'To av tre signaler':'Ett signal'}</span><span style={{fontSize:13,fontWeight:600,color:T.ink,fontFamily:'monospace'}}>{counts[cat]}</span>
              </div>
            ))}
            {delimCount > 0 && <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:5,background:T.delimBg,border:`1px solid rgba(196,101,10,0.1)`}}><DelimBadge /><span style={{flex:1}} /><span style={{fontSize:13,fontWeight:600,color:T.delim,fontFamily:'monospace'}}>{delimCount}</span></div>}
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:4,background:T.warnBg,border:`1px solid rgba(166,123,46,0.12)`}}><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L14.5 13H1.5L8 1Z" stroke={T.warn} strokeWidth="1.5" fill="none"/><path d="M8 6V9M8 11V11.5" stroke={T.warn} strokeWidth="1.5" strokeLinecap="round"/></svg><span style={{fontSize:11,color:T.warn,fontWeight:500}}>Kun gjeldende FOA (2017–)</span></div>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:4,background:T.hover,fontSize:10,color:T.ink3}}><span style={{fontWeight:600}}>Signaler:</span>{['R — Ref.tabell','F — Fulltekst','V — Vektor'].map(s => <span key={s} style={{display:'flex',alignItems:'center',gap:2}}><div style={{width:4,height:4,borderRadius:'50%',background:T.signalOn}} />{s}</span>)}</div>
          </div>
        </Section>
        <Section num="4" title="Kartlegging" subtitle={`Iter. ${iteration}`} idx={3} badge={gaps.length>0 ? <span style={{fontSize:10,fontWeight:700,color:T.gap,background:T.gapBg,padding:'1px 6px',borderRadius:8}}>{gaps.length} hull</span> : null}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.05em',marginBottom:6,textTransform:'uppercase'}}>Lesestatus</div>
              {['A','B','C'].map(cat => { const total=counts[cat],read=readCount(cat),pct=total?Math.round(read/total*100):0; return (<div key={cat} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}><CategoryBadge category={cat} small /><div style={{flex:1,height:3,borderRadius:2,background:T.input,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',borderRadius:2,background:cat==='A'?T.ink:T.ink2,transition:'width 0.3s ease'}} /></div><span style={{fontFamily:'monospace',fontSize:10,color:T.ink3,minWidth:24,textAlign:'right'}}>{read}/{total}</span></div>); })}
            </div>
            <div><div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.05em',marginBottom:6,textTransform:'uppercase'}}>Bestemmelsespar — interseksjoner</div>
              {GAP_MATRIX.map((g,i) => { const isGap=g.count===0; return (<div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 8px',borderRadius:4,background:isGap?T.gapBg:'transparent',border:`1px solid ${isGap?'rgba(155,77,202,0.12)':'transparent'}`,marginBottom:2,cursor:isGap?'pointer':'default'}}><span style={{fontSize:11,fontFamily:'monospace',color:T.ink2,minWidth:52}}>{g.p1.replace('FOA ','').replace('LOA ','')}</span><span style={{fontSize:10,color:T.ink4}}>∩</span><span style={{fontSize:11,fontFamily:'monospace',color:T.ink2,minWidth:52}}>{g.p2.replace('FOA ','').replace('LOA ','')}</span><span style={{flex:1}} /><span style={{fontSize:11,fontWeight:600,fontFamily:'monospace',color:isGap?T.gap:T.ink3}}>{isGap?'∅':g.count}</span></div>); })}
              {gaps.length > 0 && <div style={{marginTop:6,padding:'6px 8px',borderRadius:4,fontSize:11,lineHeight:'1.4',color:T.gap,fontStyle:'italic'}}>{gaps.length} bestemmelsespar uten felles praksis — mulige analytiske hull</div>}
            </div>
            {iteration > 1 && <div style={{padding:'7px 10px',borderRadius:4,background:T.successBg,border:`1px solid rgba(61,122,74,0.1)`,fontSize:11,color:T.success,lineHeight:'1.4'}}>Iterasjon 2: +1 treff via «binær vs. kvantitativ rådighet»</div>}
            <button onClick={onNewIteration} style={{width:'100%',padding:'8px 12px',borderRadius:5,background:'transparent',border:`1px dashed ${T.borderM}`,fontSize:12,fontWeight:500,color:T.ink3,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}} onMouseEnter={e => {e.currentTarget.style.borderColor=T.borderS;e.currentTarget.style.color=T.ink}} onMouseLeave={e => {e.currentTarget.style.borderColor=T.borderM;e.currentTarget.style.color=T.ink3}}>+ Ny iterasjon med nye seeds</button>
          </div>
        </Section>
        <Section num="5" title="Om rangeringen" idx={4}>
          <div style={{fontSize:12,lineHeight:'1.55',color:T.ink2}}>
            <p style={{margin:'0 0 8px'}}><strong style={{color:T.ink,fontWeight:600}}>Siteringsretning skaper systematisk skjevhet.</strong> Eldre saker dominerer sentralitetsrangeringen.</p>
            <p style={{margin:'0 0 8px'}}>Kombiner «Siteringer» med «Dato» for å balansere.</p>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:4,background:T.hover,marginTop:4}}>
              <div style={{display:'flex',gap:6}}><ValencePip valence="confirming" size={11} /><ValencePip valence="distinguishing" size={11} /><ValencePip valence="departing" size={11} /></div>
              <span style={{fontSize:10,color:T.ink3}}>Bekreftende · Avgrensende · Fravikende</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ═══════════════════════════ GRAPH VIEW ═══════════════════════════ */
function GraphView({nodes, edges, onSelectNode, selectedId, readNodes, showOldReg}) {
  const visibleNodes = useMemo(() => nodes.filter(n => showOldReg || n.regulation !== 'old'), [nodes, showOldReg]);
  const positions = useMemo(() => {
    const pos = {};
    const provs = visibleNodes.filter(n => n.type==='provision');
    provs.forEach((n,i) => { pos[n.id] = {x:120+i*145, y:55}; });
    const cs = visibleNodes.filter(n => n.type==='kofa_case').sort((a,b) => {const o={A:0,B:1,C:2}; return (o[a.category]||9)-(o[b.category]||9)||(b.citations||0)-(a.citations||0);});
    cs.forEach((n,i) => { pos[n.id] = {x:70+(i%4)*175, y:195+Math.floor(i/4)*110}; });
    const eus = visibleNodes.filter(n => n.type==='eu_case');
    eus.forEach((n,i) => { pos[n.id] = {x:140+i*210, y:430}; });
    const preps = visibleNodes.filter(n => n.type==='prep_work');
    preps.forEach((n,i) => { pos[n.id] = {x:500+i*170, y:430}; });
    return pos;
  }, [visibleNodes]);

  const visEdges = edges.filter(e => positions[e.from] && positions[e.to]).map(e => ({...e, x1:positions[e.from].x, y1:positions[e.from].y, x2:positions[e.to].x, y2:positions[e.to].y}));
  const nodeSize = n => { const b=22; if (n.citations>=10) return b+10; if (n.citations>=5) return b+5; return b; };
  const eDash = v => v==='distinguishing'?'5,3':v==='departing'?'2,3':'none';
  const eColor = v => v==='distinguishing'?T.warn:v==='departing'?T.danger:T.borderM;

  const gapEdges = GAP_MATRIX.filter(g => g.count===0).map(g => {
    const n1 = visibleNodes.find(n => n.label===g.p1), n2 = visibleNodes.find(n => n.label===g.p2);
    if (!n1||!n2||!positions[n1.id]||!positions[n2.id]) return null;
    return {x1:positions[n1.id].x, y1:positions[n1.id].y, x2:positions[n2.id].x, y2:positions[n2.id].y};
  }).filter(Boolean);

  return (
    <svg width="100%" height="100%" viewBox="0 0 800 510" style={{background:'transparent'}}>
      <text x={14} y={55} fontSize={9.5} fill={T.ink4} fontWeight={600} letterSpacing="0.05em" fontFamily="sans-serif">BESTEMMELSER</text>
      <text x={14} y={195} fontSize={9.5} fill={T.ink4} fontWeight={600} letterSpacing="0.05em" fontFamily="sans-serif">PRAKSIS</text>
      <text x={14} y={430} fontSize={9.5} fill={T.ink4} fontWeight={600} letterSpacing="0.05em" fontFamily="sans-serif">EU / FORARBEIDER</text>
      {gapEdges.map((e,i) => (<g key={'gap'+i}><line x1={e.x1} y1={e.y1+14} x2={e.x2} y2={e.y2+14} stroke={T.gap} strokeWidth={1.5} strokeDasharray="3,5" opacity={0.35}/><text x={(e.x1+e.x2)/2} y={(e.y1+e.y2)/2+22} textAnchor="middle" fontSize={8} fill={T.gap} fontWeight={600} fontFamily="sans-serif" opacity={0.7}>∅</text></g>))}
      {visEdges.map((e,i) => (<line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={eColor(e.valence)} strokeWidth={e.valence==='departing'?1.5:1} strokeDasharray={eDash(e.valence)} opacity={e.valence==='unknown'?0.3:0.5} />))}
      {visibleNodes.filter(n => positions[n.id]).map(n => {
        const pos=positions[n.id], c=nc(n.type), sz=nodeSize(n), sel=selectedId===n.id, read=readNodes.has(n.id);
        return (
          <g key={n.id} onClick={() => onSelectNode(n)} style={{cursor:'pointer',opacity:(!showOldReg&&n.regulation==='old')?0.2:1}} transform={`translate(${pos.x},${pos.y})`}>
            {sel && <circle r={sz+6} fill="none" stroke={c.accent} strokeWidth={2} opacity={0.3} />}
            {n.type==='provision' ? (<rect x={-sz*1.3} y={-sz*0.6} width={sz*2.6} height={sz*1.2} rx={4} fill={c.bg} stroke={sel?c.accent:c.border} strokeWidth={sel?1.5:1} />) : n.type==='eu_case' ? (<rect x={-sz*0.6} y={-sz*0.6} width={sz*1.2} height={sz*1.2} rx={3} fill={c.bg} stroke={sel?c.accent:c.border} strokeWidth={sel?1.5:1} transform="rotate(45)" />) : (<circle r={sz} fill={c.bg} stroke={sel?c.accent:c.border} strokeWidth={sel?1.5:1} />)}
            <text textAnchor="middle" dy={1} fontSize={10} fontWeight={600} fill={c.accent} fontFamily="monospace" style={{pointerEvents:'none'}}>{n.label}</text>
            <text textAnchor="middle" dy={n.type==='provision'?14:sz+13} fontSize={8.5} fill={T.ink3} fontFamily="sans-serif" style={{pointerEvents:'none'}}>{(n.subtitle||'').length>24?(n.subtitle||'').slice(0,22)+'…':n.subtitle}</text>
            {n.category && (<g transform={`translate(${n.type==='provision'?sz*1.3-6:sz-2},${n.type==='provision'?-sz*0.6-5:-sz-5})`}><rect x={-7} y={-6} width={14} height={12} rx={3} fill={T.surface} stroke={T.borderM} strokeWidth={0.5} /><text textAnchor="middle" dy={3} fontSize={8.5} fontWeight={700} fill={T.ink} fontFamily="sans-serif" style={{pointerEvents:'none'}}>{n.category}</text></g>)}
            {n.isDelimitation && (<g transform={`translate(${sz+8},${-sz+4})`}><circle r={6} fill={T.delimBg} stroke={T.delim} strokeWidth={0.8} /><line x1={-2.5} y1={-2.5} x2={2.5} y2={2.5} stroke={T.delim} strokeWidth={1.2} /></g>)}
            {read && (<g transform={`translate(${sz+4},${-4})`}><circle r={5} fill={T.successBg} stroke={T.success} strokeWidth={0.7} /><path d="M-2 0L-0.5 1.5L2.5 -1.5" stroke={T.success} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>)}
            {n.iteration===2 && (<g transform={`translate(0,${sz+25})`}><rect x={-14} y={-5} width={28} height={10} rx={5} fill={T.successBg} stroke="rgba(61,122,74,0.12)" strokeWidth={0.5} /><text textAnchor="middle" dy={2.5} fontSize={7.5} fill={T.success} fontWeight={600} fontFamily="sans-serif" style={{pointerEvents:'none'}}>iter. 2</text></g>)}
            {n.isSeed && <circle cx={n.type==='provision'?-sz*1.3-5:-sz-5} cy={0} r={3} fill={c.accent} opacity={0.5} />}
          </g>
        );
      })}
      <g transform="translate(620,12)">
        <text x={0} y={0} fontSize={9} fill={T.ink4} fontWeight={600} fontFamily="sans-serif">SITERINGSVALENS</text>
        <line x1={0} y1={10} x2={28} y2={10} stroke={T.borderM} strokeWidth={1} opacity={0.5} /><text x={33} y={13} fontSize={8.5} fill={T.ink4} fontFamily="sans-serif">Ukjent</text>
        <line x1={0} y1={22} x2={28} y2={22} stroke={T.warn} strokeWidth={1} strokeDasharray="5,3" opacity={0.6} /><text x={33} y={25} fontSize={8.5} fill={T.ink4} fontFamily="sans-serif">Avgrensende</text>
        <line x1={0} y1={34} x2={28} y2={34} stroke={T.danger} strokeWidth={1.5} strokeDasharray="2,3" opacity={0.6} /><text x={33} y={37} fontSize={8.5} fill={T.ink4} fontFamily="sans-serif">Fravikende</text>
        <line x1={0} y1={46} x2={28} y2={46} stroke={T.gap} strokeWidth={1.5} strokeDasharray="3,5" opacity={0.4} /><text x={33} y={49} fontSize={8.5} fill={T.gap} fontFamily="sans-serif">Hull (∅)</text>
      </g>
    </svg>
  );
}

/* ═══════════════════════════ LIST VIEW ═══════════════════════════ */
function ListView({nodes, onSelectNode, selectedId, readNodes, onToggleRead, showOldReg, listFilter}) {
  const [sortBy, setSortBy] = useState('category');
  const filtered = useMemo(() => {
    let items = nodes.filter(n => n.category);
    if (!showOldReg) items = items.filter(n => n.regulation !== 'old');
    if (listFilter==='delimitation') items = items.filter(n => n.isDelimitation);
    if (listFilter==='unread') items = items.filter(n => !readNodes.has(n.id));
    if (sortBy==='category') return [...items].sort((a,b) => {const o={A:0,B:1,C:2}; return (o[a.category]||9)-(o[b.category]||9);});
    if (sortBy==='citations') return [...items].sort((a,b) => (b.citations||0)-(a.citations||0));
    if (sortBy==='date') return [...items].sort((a,b) => ((b.date||'')>(a.date||'')?1:-1));
    return items;
  }, [nodes, sortBy, showOldReg, readNodes, listFilter]);

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',gap:4,padding:'8px 16px',borderBottom:`1px solid ${T.border}`,flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:600,color:T.ink3,marginRight:2}}>Sorter:</span>
        {[['category','Kategori'],['citations','Siteringer'],['date','Dato']].map(([k,l]) => (
          <button key={k} onClick={() => setSortBy(k)} style={{padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:500,cursor:'pointer',background:sortBy===k?T.ink:'transparent',color:sortBy===k?T.panel:T.ink3,border:`1px solid ${sortBy===k?T.ink:T.borderM}`}}>{l}</button>
        ))}
        {sortBy==='citations' && <span style={{fontSize:9,color:T.ink4,fontStyle:'italic',marginLeft:4}}>Eldre saker dominerer — kombiner med dato</span>}
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {filtered.length===0 && <div style={{padding:24,textAlign:'center',color:T.ink3,fontSize:13}}>Ingen treff med aktive filtre</div>}
        {filtered.map(n => {
          const c=nc(n.type), sel=selectedId===n.id, read=readNodes.has(n.id), hasAI=!!AI_CURATION[n.id];
          const oStyle = n.outcome ? {Brudd:{c:T.warn,bg:T.warnBg},'Ikke brudd':{c:T.success,bg:T.successBg},Avvist:{c:T.ink3,bg:T.hover}}[n.outcome] : null;
          return (
            <div key={n.id} onClick={() => onSelectNode(n)} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'11px 16px',cursor:'pointer',background:sel?T.active:'transparent',borderBottom:`1px solid ${T.border}`,borderLeft:`3px solid ${sel?c.accent:'transparent'}`,transition:'background 0.1s ease'}} onMouseEnter={e => {if(!sel)e.currentTarget.style.background=T.hover}} onMouseLeave={e => {if(!sel)e.currentTarget.style.background='transparent'}}>
              <div onClick={e => {e.stopPropagation();onToggleRead(n.id)}} style={{width:15,height:15,borderRadius:3,marginTop:2,flexShrink:0,cursor:'pointer',border:`1.5px solid ${read?T.success:T.borderS}`,background:read?T.successBg:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {read && <svg width="9" height="9" viewBox="0 0 10 10"><path d="M2 5L4 7L8 3" stroke={T.success} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2,flexWrap:'wrap'}}>
                  <NodeTypeIcon type={n.type} size={11} />
                  <span style={{fontSize:12.5,fontWeight:600,color:T.ink,fontFamily:'monospace'}}>{n.label}</span>
                  <CategoryBadge category={n.category} small />
                  <SignalDots signals={n.signals} size={5} />
                  {n.isDelimitation && <DelimBadge />}
                  {hasAI && <span style={{fontSize:9,fontWeight:600,color:T.aiAccent,background:T.highlight,padding:'1px 5px',borderRadius:3,border:`1px solid ${T.aiCommentBorder}`}}>AI-kuratert</span>}
                  {n.iteration===2 && <span style={{fontSize:9,fontWeight:600,color:T.success,background:T.successBg,padding:'1px 5px',borderRadius:8}}>iter. 2</span>}
                </div>
                <div style={{fontSize:11.5,color:T.ink2,marginBottom:3}}>{n.subtitle}</div>
                <div style={{display:'flex',alignItems:'center',gap:7,fontSize:10.5,color:T.ink3,flexWrap:'wrap'}}>
                  {n.date && <span>{n.date}</span>}
                  {oStyle && <span style={{padding:'1px 5px',borderRadius:3,fontSize:10,fontWeight:600,background:oStyle.bg,color:oStyle.c}}>{n.outcome}</span>}
                  {n.citations>0 && <span>{n.citations} sit.</span>}
                  {n.directive && <span style={{fontStyle:'italic',color:T.eu.accent}}>{n.directive}</span>}
                  {n.valence && Object.entries(n.valence).filter(([_,v]) => v!=='unknown').map(([target,val]) => (<span key={target} style={{display:'flex',alignItems:'center',gap:2}}><ValencePip valence={val} size={9} /><span style={{fontFamily:'monospace',fontSize:9.5}}>{NODES.find(x=>x.id===target)?.label}</span></span>))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════ AI READING COMPONENTS ═══════════════════════════ */
function AiComment({comment, onNavigate}) {
  return (
    <div style={{margin:'8px 0 12px',padding:'10px 12px',borderRadius:5,borderLeft:`3px solid ${T.aiCommentBorder}`,background:T.aiCommentBg}}>
      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
        <span style={{fontSize:10,fontWeight:700,color:T.aiAccent,background:T.highlight,padding:'1px 5px',borderRadius:3,border:`1px solid ${T.aiCommentBorder}`}}>AI</span>
      </div>
      <div style={{fontSize:12.5,lineHeight:'1.55',color:T.ink2}}>{comment.text}</div>
      {comment.crossRef && (
        <button onClick={() => onNavigate(comment.crossRef)} style={{display:'flex',alignItems:'center',gap:5,marginTop:8,padding:'5px 10px',borderRadius:4,background:T.surface,border:`1px solid ${T.borderM}`,fontSize:11.5,fontWeight:500,color:T.ink2,cursor:'pointer',width:'100%',textAlign:'left'}} onMouseEnter={e => {e.currentTarget.style.borderColor=T.borderS;e.currentTarget.style.color=T.ink}} onMouseLeave={e => {e.currentTarget.style.borderColor=T.borderM;e.currentTarget.style.color=T.ink2}}>
          <span style={{fontSize:14,color:T.aiAccent}}>→</span>
          <span style={{fontFamily:'monospace',fontWeight:600,color:T.kofa.accent}}>{comment.crossRef.label}</span>
          <span style={{color:T.ink3,fontSize:10.5}}>{comment.crossRef.note}</span>
        </button>
      )}
    </div>
  );
}

function ReadingMode({node, curation, onNavigate, showAll, setShowAll}) {
  const paragraphs = DECISION_TEXT[node.id] || [];
  const hlSet = new Set(curation?.highlights?.map(h => h.p) || []);
  const commentMap = {};
  (curation?.comments||[]).forEach(c => { commentMap[c.afterParagraph] = c; });

  return (
    <div>
      {curation?.highlights?.length > 0 && (
        <div style={{padding:'10px 16px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <span style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.04em'}}>MARKERTE:</span>
          {curation.highlights.map(h => (
            <button key={h.p} onClick={() => document.getElementById(`p-${node.id}-${h.p}`)?.scrollIntoView({behavior:'smooth',block:'center'})} style={{padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:600,background:T.highlight,border:`1px solid ${T.aiCommentBorder}`,color:T.aiAccent,cursor:'pointer'}}>§{h.p}</button>
          ))}
          <span style={{flex:1}} />
          <button onClick={() => setShowAll(!showAll)} style={{fontSize:10,color:T.ink3,background:'transparent',border:'none',cursor:'pointer',textDecoration:'underline'}}>{showAll ? 'Vis bare markerte' : 'Vis all tekst'}</button>
        </div>
      )}
      <div style={{padding:'12px 16px'}}>
        {paragraphs.map(({p, text}) => {
          const isHl = hlSet.has(p);
          const comment = commentMap[p];
          const hl = curation?.highlights?.find(h => h.p===p);
          if (!showAll && !isHl) return (<div key={p} style={{padding:'4px 0',margin:'2px 0',fontSize:11,color:T.ink4,cursor:'pointer',paddingLeft:10}} onClick={() => setShowAll(true)}><span style={{fontFamily:'monospace',fontSize:10,marginRight:6}}>({p})</span><span style={{fontStyle:'italic'}}>{text.slice(0,60)}…</span></div>);
          return (
            <div key={p} id={`p-${node.id}-${p}`} style={{marginBottom:isHl?4:8}}>
              <div style={{fontSize:10,fontFamily:'monospace',color:isHl?T.aiAccent:T.ink4,marginBottom:3,fontWeight:isHl?600:400}}>
                Avsnitt {p}{hl && <span style={{marginLeft:8,fontSize:9,fontWeight:400,color:T.ink3,fontFamily:'sans-serif'}}>{hl.relevance}</span>}
              </div>
              <div style={{fontSize:13.5,lineHeight:'1.7',color:T.ink,padding:isHl?'8px 12px':'2px 12px',borderRadius:isHl?4:0,background:isHl?T.highlight:'transparent',borderLeft:isHl?`3px solid ${T.aiCommentBorder}`:'2px solid transparent'}}>{text}</div>
              {comment && <AiComment comment={comment} onNavigate={onNavigate} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════ RIGHT PANEL ═══════════════════════════ */
function RightPanel({node, notes, onUpdateNote, isRead, onToggleRead, onClose, onSelectNode}) {
  const c = nc(node.type);
  const [noteText, setNoteText] = useState(notes[node.id]||'');
  const [mode, setMode] = useState('overview');
  const [showAll, setShowAll] = useState(false);
  const connectedNodes = NODES.filter(n => node.connectedTo?.includes(n.id));
  const oStyle = node.outcome ? {Brudd:{c:T.warn,bg:T.warnBg},'Ikke brudd':{c:T.success,bg:T.successBg},Avvist:{c:T.ink3,bg:T.hover}}[node.outcome] : null;
  const getValence = tid => node.valence?.[tid]||NODES.find(n=>n.id===tid)?.valence?.[node.id]||'unknown';
  const curation = AI_CURATION[node.id];
  const hasText = !!DECISION_TEXT[node.id];

  useEffect(() => { setMode('overview'); setShowAll(false); }, [node.id]);
  useEffect(() => { setNoteText(notes[node.id]||''); }, [node.id, notes]);

  const handleNavigate = (crossRef) => {
    const target = NODES.find(n => n.id===crossRef.caseId);
    if (target) { onSelectNode(target); setTimeout(() => { setMode('reading'); setTimeout(() => document.getElementById(`p-${crossRef.caseId}-${crossRef.paragraph}`)?.scrollIntoView({behavior:'smooth',block:'center'}), 100); }, 50); }
  };

  return (
    <div style={{width:410,minWidth:410,height:'100%',background:T.panel,borderLeft:`1px solid ${T.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'14px 16px',borderBottom:`1px solid ${T.border}`,background:c.bg,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <div style={{display:'flex',alignItems:'center',gap:5}}><NodeTypeIcon type={node.type} size={13} /><span style={{fontSize:11,fontWeight:600,color:c.accent,letterSpacing:'0.03em'}}>{c.label}</span></div>
          <button onClick={onClose} style={{width:22,height:22,borderRadius:4,border:'none',background:'transparent',cursor:'pointer',color:T.ink3,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        <div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:'monospace',marginBottom:3}}>
          {node.type==='eu_case'&&node.subtitle ? <>{node.subtitle} <span style={{fontSize:12,fontWeight:500,color:T.ink3}}>{node.label}</span></> : node.label}
        </div>
        {node.type!=='eu_case' && <div style={{fontSize:12.5,color:T.ink2}}>{node.subtitle}</div>}
        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8,flexWrap:'wrap'}}>
          {node.category && <CategoryBadge category={node.category} />}
          {node.signals && <SignalDots signals={node.signals} />}
          {node.isDelimitation && <DelimBadge />}
          {node.date && <span style={{fontSize:11,color:T.ink3}}>{node.date}</span>}
          {oStyle && <span style={{padding:'2px 7px',borderRadius:4,fontSize:11,fontWeight:600,background:oStyle.bg,color:oStyle.c}}>{node.outcome}</span>}
          {node.citations>0 && <span style={{fontSize:11,color:T.ink3}}>{node.citations} sit.</span>}
          {node.directive && <span style={{fontSize:11,color:T.eu.accent,fontWeight:500}}>{node.directive}</span>}
        </div>
        {hasText && (
          <div style={{display:'flex',marginTop:10,borderRadius:5,border:`1px solid ${T.borderM}`,overflow:'hidden'}}>
            {[['overview','Oversikt'],['reading','Les avgjørelsen']].map(([k,l]) => (
              <button key={k} onClick={() => setMode(k)} style={{flex:1,padding:'5px 0',fontSize:11,fontWeight:mode===k?600:400,cursor:'pointer',background:mode===k?T.ink:'transparent',color:mode===k?T.panel:T.ink3,border:'none'}}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto'}}>
        {mode==='reading' && curation ? (
          <ReadingMode node={node} curation={curation} onNavigate={handleNavigate} showAll={showAll} setShowAll={setShowAll} />
        ) : (
          <>
            {/* AI highlights preview */}
            {curation && (
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:T.aiAccent,background:T.highlight,padding:'1px 5px',borderRadius:3,border:`1px solid ${T.aiCommentBorder}`}}>AI</span>
                  <span style={{fontSize:10,fontWeight:600,color:T.aiAccent,letterSpacing:'0.04em',textTransform:'uppercase'}}>Relevante avsnitt</span>
                  <span style={{fontSize:10,color:T.ink4}}>— markert for din problemstilling</span>
                </div>
                {curation.highlights.map((h,i) => {
                  const para = (DECISION_TEXT[node.id]||[]).find(pp => pp.p===h.p);
                  const snippet = para ? para.text.slice(h.ranges[0][0], Math.min(h.ranges[0][1], para.text.length)) : '';
                  const comment = curation.comments?.find(cm => cm.afterParagraph===h.p);
                  return (
                    <div key={i} style={{marginBottom:10,padding:'8px 10px',borderRadius:5,background:T.highlight,borderLeft:`3px solid ${T.aiCommentBorder}`}}>
                      <div style={{fontSize:10,fontFamily:'monospace',color:T.aiAccent,fontWeight:600,marginBottom:3}}>Avsnitt {h.p} <span style={{fontFamily:'sans-serif',fontWeight:400,color:T.ink3,fontSize:9.5,marginLeft:4}}>{h.relevance}</span></div>
                      <div style={{fontSize:12.5,lineHeight:'1.55',color:T.ink}}>«{snippet.length>180?snippet.slice(0,180)+'…':snippet}»</div>
                      {comment?.crossRef && (
                        <button onClick={() => handleNavigate(comment.crossRef)} style={{display:'flex',alignItems:'center',gap:4,marginTop:6,padding:'4px 8px',borderRadius:3,background:T.surface,border:`1px solid ${T.borderM}`,fontSize:10.5,color:T.ink2,cursor:'pointer'}} onMouseEnter={e => {e.currentTarget.style.background=T.hover}} onMouseLeave={e => {e.currentTarget.style.background=T.surface}}>
                          <span style={{color:T.aiAccent}}>→</span><span style={{fontFamily:'monospace',fontWeight:600,color:T.kofa.accent}}>{comment.crossRef.label}</span><span style={{color:T.ink4}}>{comment.crossRef.note}</span>
                        </button>
                      )}
                      <button onClick={() => { setMode('reading'); setTimeout(() => document.getElementById(`p-${node.id}-${h.p}`)?.scrollIntoView({behavior:'smooth',block:'center'}), 100); }} style={{display:'block',marginTop:4,fontSize:10.5,color:T.aiAccent,background:'transparent',border:'none',cursor:'pointer',padding:0,fontWeight:500}}>Les i kontekst →</button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Static detail */}
            {!curation && (
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`}}>
                <div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:6}}>{node.type==='provision'?'Ordlyd':'Sammendrag'}</div>
                <div style={{fontSize:13,lineHeight:'1.6',color:T.ink}}>{node.detail}</div>
              </div>
            )}
            {/* Signals */}
            {node.signals && (
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`}}>
                <div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:6}}>Treffsignaler</div>
                {[{k:'ref',l:'Referansetabell'},{k:'fts',l:'Fulltekstsøk'},{k:'vec',l:'Vektorsøk'}].map(({k,l}) => (<div key={k} style={{display:'flex',alignItems:'center',gap:7,padding:'4px 6px',borderRadius:3,background:node.signals[k]?'rgba(26,24,20,0.025)':'transparent',marginBottom:2}}><div style={{width:6,height:6,borderRadius:'50%',background:node.signals[k]?T.signalOn:'transparent',border:`1.5px solid ${node.signals[k]?T.signalOn:T.signalOff}`,flexShrink:0}} /><span style={{fontSize:11.5,fontWeight:node.signals[k]?600:400,color:node.signals[k]?T.ink:T.ink4}}>{l}</span></div>))}
              </div>
            )}
            {/* Relations with valence */}
            {connectedNodes.length > 0 && (
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`}}>
                <div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:6}}>Relasjoner ({connectedNodes.length})</div>
                {connectedNodes.map(cn => { const cc=nc(cn.type), v=getValence(cn.id); return (
                  <div key={cn.id} onClick={() => onSelectNode(cn)} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 6px',borderRadius:4,cursor:'pointer',marginBottom:1}} onMouseEnter={e => e.currentTarget.style.background=T.hover} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <NodeTypeIcon type={cn.type} size={10} /><span style={{fontFamily:'monospace',fontWeight:500,color:cc.accent,fontSize:11.5}}>{cn.label}</span>{v!=='unknown' && <ValencePip valence={v} size={9} />}<span style={{color:T.ink4,fontSize:10,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cn.subtitle?.slice(0,28)}</span>
                  </div>
                ); })}
              </div>
            )}
          </>
        )}
        {/* Notes — always */}
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:6}}>Mine notater</div>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} onBlur={() => onUpdateNote(node.id,noteText)} placeholder="Skriv notater om denne rettskilden…" rows={3} style={{width:'100%',padding:'7px 10px',borderRadius:5,border:`1px solid ${T.borderM}`,background:T.input,fontSize:12.5,lineHeight:'1.5',color:T.ink,resize:'vertical',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}} onFocus={e => e.target.style.borderColor=T.kofa.accent} onBlurCapture={e => e.target.style.borderColor=T.borderM} />
        </div>
        {/* Actions — always */}
        <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:6}}>
          <button onClick={() => onToggleRead(node.id)} style={{width:'100%',padding:'7px 12px',borderRadius:5,background:isRead?T.successBg:'transparent',border:`1px solid ${isRead?'rgba(61,122,74,0.18)':T.borderM}`,color:isRead?T.success:T.ink2,fontSize:12,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>{isRead ? '✓ Lest og vurdert' : 'Marker som lest'}</button>
          <button style={{width:'100%',padding:'7px 12px',borderRadius:5,background:'transparent',border:`1px solid ${T.borderM}`,color:T.ink2,fontSize:12,fontWeight:500,cursor:'pointer'}} onMouseEnter={e => {e.currentTarget.style.borderColor=T.borderS;e.currentTarget.style.color=T.ink}} onMouseLeave={e => {e.currentTarget.style.borderColor=T.borderM;e.currentTarget.style.color=T.ink2}}>Bruk som seed i neste iterasjon</button>
          {node.isDelimitation && <div style={{padding:'7px 10px',borderRadius:5,background:T.delimBg,border:`1px solid rgba(196,101,10,0.1)`,fontSize:11,color:T.delim,lineHeight:'1.4',textAlign:'center'}}>Avgrensningspraksis — bestemmelsen ble vurdert som ikke-anvendelig</div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function LegalGraphWorkbench() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [leftOpen, setLeftOpen] = useState(true);
  const [readNodes, setReadNodes] = useState(new Set());
  const [notes, setNotes] = useState({});
  const [iteration, setIteration] = useState(2);
  const [showOldReg, setShowOldReg] = useState(false);
  const [listFilter, setListFilter] = useState('all');

  const toggleRead = useCallback(id => { setReadNodes(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; }); }, []);
  const updateNote = useCallback((id,text) => setNotes(p => ({...p,[id]:text})), []);

  return (
    <div style={{display:'flex',height:'100vh',width:'100%',background:T.bg,fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",color:T.ink}}>
      {leftOpen && <LeftPanel iteration={iteration} onNewIteration={() => setIteration(i=>i+1)} readNodes={readNodes} />}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
        {/* Toolbar */}
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderBottom:`1px solid ${T.border}`,background:T.panel,flexWrap:'wrap'}}>
          <button onClick={() => setLeftOpen(p=>!p)} style={{width:28,height:28,borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.ink3}}>
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><line x1="5" y1="2" x2="5" y2="12" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
          <div style={{width:1,height:16,background:T.border}} />
          <div style={{display:'flex',borderRadius:5,border:`1px solid ${T.border}`,overflow:'hidden'}}>
            {[['list','Liste'],['graph','Graf']].map(([k,l]) => (
              <button key={k} onClick={() => setViewMode(k)} style={{padding:'4px 11px',fontSize:11,fontWeight:500,cursor:'pointer',background:viewMode===k?T.ink:'transparent',color:viewMode===k?T.panel:T.ink3,border:'none'}}>{l}</button>
            ))}
          </div>
          {viewMode==='list' && (<>
            <div style={{width:1,height:16,background:T.border}} />
            <span style={{fontSize:11,color:T.ink3,fontWeight:500}}>Vis:</span>
            {[['all','Alle'],['delimitation','Avgrensning'],['unread','Ulest']].map(([k,l]) => (
              <button key={k} onClick={() => setListFilter(k)} style={{padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:500,cursor:'pointer',background:listFilter===k?(k==='delimitation'?T.delim:T.ink):'transparent',color:listFilter===k?T.panel:T.ink3,border:`1px solid ${listFilter===k?(k==='delimitation'?T.delim:T.ink):T.borderM}`}}>{l}</button>
            ))}
          </>)}
          <div style={{flex:1}} />
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:10,color:T.ink4}}>
            {[['provision','Best.'],['kofa_case','KOFA'],['eu_case','EU'],['prep_work','Forarb.']].map(([t,l]) => (<span key={t} style={{display:'flex',alignItems:'center',gap:2}}><NodeTypeIcon type={t} size={9} />{l}</span>))}
          </div>
        </div>
        {/* Content */}
        <div style={{flex:1,overflow:'auto'}}>
          {viewMode==='graph' ? (
            <GraphView nodes={NODES} edges={EDGES} onSelectNode={setSelectedNode} selectedId={selectedNode?.id} readNodes={readNodes} showOldReg={showOldReg} />
          ) : (
            <ListView nodes={NODES} onSelectNode={setSelectedNode} selectedId={selectedNode?.id} readNodes={readNodes} onToggleRead={toggleRead} showOldReg={showOldReg} listFilter={listFilter} />
          )}
        </div>
      </div>
      {selectedNode && <RightPanel node={selectedNode} notes={notes} onUpdateNote={updateNote} isRead={readNodes.has(selectedNode.id)} onToggleRead={toggleRead} onClose={() => setSelectedNode(null)} onSelectNode={setSelectedNode} />}
    </div>
  );
}
