import { useState } from "react";

const T = {
  bg: '#F5F3EE',
  panel: '#FAF9F6',
  surface: '#FFFFFF',
  input: '#EFECE5',
  ink: '#1A1814',
  ink2: '#5C564D',
  ink3: '#8C8578',
  ink4: '#B0A99E',
  border: 'rgba(26,24,20,0.08)',
  borderM: 'rgba(26,24,20,0.13)',
  borderS: 'rgba(26,24,20,0.22)',
  prov: '#4A6670',
  provBg: '#E8EEF0',
  kofa: '#8B6914',
  kofaBg: '#F0EBD8',
  ai: '#8B6914',
  aiBorder: 'rgba(139,105,20,0.2)',
  highlight: '#FBF5E8',
  confirm: '#3D7A4A',
  confirmBg: '#EBF5ED',
  warn: '#A67B2E',
  warnBg: '#FBF5E8',
};

/* ═══════════════ MOCK STATES ═══════════════ */

const INITIAL_INPUT = 'Jeg skal gjennomføre en del III-anskaffelse for arkitekttjenester til reguleringsarbeid, forhandlet prosedyre. Forventer mange tilbud og vil begrense antall. Hva er lovlig og hensiktsmessig etter § 16-12?';

const SCOPING_RESULT = {
  refined: 'Hvilke utvelgelseskriterier etter FOA § 16-12 er lovlige og hensiktsmessige for å velge ut de best kvalifiserte kandidatene blant arkitekter/konsulenter til reguleringsfase?',
  subProblems: [
    'Hva er det rettslige handlingsrommet for utvelgelseskriterier etter § 16-12?',
    'Hvilke begrensninger følger av lovtekst, forarbeider og KOFA-praksis?',
    'Hvilke kriterier har KOFA vurdert — og hva har bestått/feilet?',
    'Konkret anbefaling: 1–2 kriterier tilpasset arkitekt/konsulent + reguleringsfase.',
  ],
  context: {
    procedure: 'Forhandlet prosedyre med forutgående kunngjøring (FOA § 13-2)',
    serviceArea: 'Arkitekt-/konsulentarbeid i reguleringsfase',
    market: 'Mange potensielle tilbydere — behov for reell utvelgelse',
    threshold: 'Del III-anskaffelse (over EØS-terskelverdi)',
  },
  provisions: [
    { id: 'foa-16-12', ref: 'FOA § 16-12', label: 'Utvelgelse av leverandører', primary: true,
      verified: true,
      excerpt: 'Når oppdragsgiver benytter prosedyrer som tillater begrensning av antall kvalifiserte kandidater som inviteres til å inngi tilbud eller delta i dialog, skal utvelgelsen skje på grunnlag av objektive og ikke-diskriminerende kriterier eller regler som er angitt i kunngjøringen.' },
    { id: 'foa-16-5', ref: 'FOA § 16-5', label: 'Tekniske og faglige kvalifikasjoner', primary: true,
      verified: true,
      excerpt: 'Oppdragsgiver kan stille krav til leverandørens tekniske og faglige kvalifikasjoner for å sikre at leverandøren har de nødvendige menneskelige og tekniske ressurser og den nødvendige erfaring til å utføre kontrakten.' },
    { id: 'foa-16-6', ref: 'FOA § 16-6', label: 'Dokumentasjon for tekniske kvalifikasjoner', primary: true,
      verified: true,
      excerpt: 'Leverandørens tekniske og faglige kvalifikasjoner kan dokumenteres med ett eller flere av følgende: (b) en oversikt over de viktigste leveransene de siste tre årene, (c) opplysninger om teknisk personell, (f) utdanning og faglige kvalifikasjoner.' },
    { id: 'foa-16-1', ref: 'FOA § 16-1', label: 'Kvalifikasjonskrav — rammebestemmelse', primary: false,
      verified: true,
      excerpt: 'Oppdragsgiver kan stille krav til leverandørens kvalifikasjoner (...). Kravene skal ha tilknytning til og stå i forhold til det som skal anskaffes.' },
    { id: 'foa-16-8', ref: 'FOA § 16-8', label: 'Leverandørens organisering', primary: false,
      verified: true,
      excerpt: 'For tjeneste- og bygge- og anleggskontrakter kan oppdragsgiver kreve at leverandøren opplyser om navn og faglige kvalifikasjoner for de personene som skal utføre kontrakten.' },
    { id: 'dir-art-65', ref: 'Dir. 2014/24/EU art. 65', label: 'Reduction of candidates', primary: true,
      verified: false,
      excerpt: 'Where contracting authorities limit the number of candidates to be invited (...) they shall apply objective and non-discriminatory criteria or rules. Min. 3 for negotiated procedure.',
      verifyNote: 'Ikke i databasen — hentet via web' },
  ],
  searchStrategy: {
    refTable: ['Alle KOFA-saker som refererer § 16-12', 'Saker som refererer både § 16-12 og § 16-5 (interseksjon)'],
    fts: ['«utvelgelseskriterier»', '«utvelgelse kvalifiserte»'],
    vector: [
      'Begrensning av antall kvalifiserte kandidater ved forhandlet prosedyre',
      'Rangering av leverandører etter kompetanse og erfaring',
    ],
    prepWork: ['Forarbeider til § 16-12', 'Fulltekstsøk i forarbeider: «utvelgelseskriterier»'],
  },
  reasoning: 'Problemstillingen dreier seg om § 16-12 som gir hjemmel for utvelgelse, men kriteriene må forankres i kvalifikasjonskravene i § 16-5/§ 16-6. Direktivartikkel 65 er det EU-rettslige grunnlaget. Søkestrategien bruker referansetabell som basis, supplert med FTS og vektorsøk for å fange saker som drøfter utvelgelseskriterier uten eksplisitt § 16-12-referanse.',
};

/* ═══════════════ COMPONENTS ═══════════════ */

function StepIndicator({ steps, activeStep }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '12px 24px',
      borderBottom: `1px solid ${T.border}`,
      background: T.panel,
    }}>
      {steps.map((step, i) => {
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: isDone ? T.ink : isActive ? T.ink : 'transparent',
                color: isDone || isActive ? T.panel : T.ink3,
                border: `1.5px solid ${isDone || isActive ? T.ink : T.borderS}`,
                transition: 'all 0.15s ease',
              }}>
                {isDone ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 12, fontWeight: isActive ? 600 : 400,
                color: isActive ? T.ink : isDone ? T.ink2 : T.ink4,
              }}>{step}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 32, height: 1,
                background: isDone ? T.ink : T.borderM,
                margin: '0 10px',
                opacity: isDone ? 0.3 : 1,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProvisionRow({ prov, onToggle }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 6,
      background: prov.primary ? T.surface : 'transparent',
      border: `1px solid ${prov.primary ? T.borderM : T.border}`,
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {/* Verified indicator */}
        <div style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          background: prov.verified ? T.confirmBg : T.warnBg,
          border: `1.5px solid ${prov.verified ? T.confirm : T.warn}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {prov.verified && (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 5L4 7L8 3" stroke={T.confirm} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </div>

        <span style={{
          fontFamily: "'Söhne Mono', 'IBM Plex Mono', monospace",
          fontSize: 12.5, fontWeight: 700, color: T.prov,
        }}>{prov.ref}</span>

        <span style={{ fontSize: 12, color: T.ink2 }}>{prov.label}</span>

        {prov.primary && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
            background: T.provBg, color: T.prov,
          }}>Primær</span>
        )}

        <span style={{ flex: 1 }} />

        {prov.verifyNote && (
          <span style={{ fontSize: 10, color: T.warn, fontStyle: 'italic' }}>{prov.verifyNote}</span>
        )}
      </div>

      {/* Excerpt — the actual law text */}
      <div style={{
        fontSize: 12.5, lineHeight: '1.6', color: T.ink,
        paddingLeft: 24,
        borderLeft: `2px solid ${T.provBg}`,
        marginLeft: 8,
      }}>
        {prov.excerpt}
      </div>
    </div>
  );
}

function EditableField({ label, value, multiline, mono }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (editing) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: T.ink3, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
          rows={multiline ? 3 : 1}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 5,
            border: `1px solid ${T.kofa}`, background: T.input,
            fontSize: 13, lineHeight: '1.55', color: T.ink,
            fontFamily: mono ? "'Söhne Mono', monospace" : 'inherit',
            resize: multiline ? 'vertical' : 'none',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{ marginBottom: 12, cursor: 'pointer', position: 'relative' }}
      title="Klikk for å redigere"
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: T.ink3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.3 }}>
          <path d="M7.5 1.5L8.5 2.5L3 8H2V7L7.5 1.5Z" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </div>
      <div style={{
        fontSize: 13, lineHeight: '1.55', color: T.ink,
        fontFamily: mono ? "'Söhne Mono', monospace" : 'inherit',
        padding: '6px 0',
        borderBottom: `1px dashed ${T.border}`,
      }}>{text}</div>
    </div>
  );
}

/* ═══════════════ MAIN FLOW ═══════════════ */

function InputPhase({ onSubmit }) {
  const [text, setText] = useState(INITIAL_INPUT);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{
        fontSize: 22, fontWeight: 700, color: T.ink,
        letterSpacing: '-0.02em', marginBottom: 6,
      }}>
        Ny analyse
      </div>
      <div style={{ fontSize: 13, color: T.ink3, marginBottom: 24 }}>
        Beskriv problemstillingen. Claude vil vurdere og foreslå presisering, bestemmelser og søkestrategi.
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Skriv problemstillingen her — kan være uformell…"
        rows={5}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 8,
          border: `1px solid ${T.borderM}`, background: T.surface,
          fontSize: 14, lineHeight: '1.6', color: T.ink,
          fontFamily: 'inherit', resize: 'vertical',
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s ease',
        }}
        onFocus={e => e.target.style.borderColor = T.kofa}
        onBlur={e => e.target.style.borderColor = T.borderM}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onSubmit} style={{
          padding: '9px 20px', borderRadius: 6,
          background: T.ink, color: T.panel, border: 'none',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'opacity 0.12s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Vurder med Claude
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7H11M11 7L8 4M11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ProposalPhase({ onApprove }) {
  const s = SCOPING_RESULT;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 24px 48px' }}>

      {/* AI attribution */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 20,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
          background: T.highlight, border: `1px solid ${T.aiBorder}`, color: T.ai,
        }}>AI</span>
        <span style={{ fontSize: 12, color: T.ink3 }}>Forslag basert på din problemstilling — alt kan redigeres</span>
      </div>

      {/* Refined problem */}
      <EditableField
        label="Problemstilling (presisert)"
        value={s.refined}
        multiline
      />

      {/* Sub-problems */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: T.ink3, letterSpacing: '0.05em',
          textTransform: 'uppercase', marginBottom: 6,
        }}>Delspørsmål</div>
        {s.subProblems.map((sp, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '4px 0', fontSize: 13, color: T.ink, lineHeight: '1.5',
          }}>
            <span style={{
              fontFamily: "'Söhne Mono', monospace", fontSize: 11,
              color: T.ink4, minWidth: 16, marginTop: 2,
            }}>{i + 1}.</span>
            {sp}
          </div>
        ))}
      </div>

      {/* Context */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: T.ink3, letterSpacing: '0.05em',
          textTransform: 'uppercase', marginBottom: 6,
        }}>Kontekst</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px',
          fontSize: 12, color: T.ink2, lineHeight: '1.5',
        }}>
          {Object.entries(s.context).map(([key, val]) => (
            <div key={key} style={{ padding: '4px 0' }}>
              <span style={{ color: T.ink4, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {key === 'procedure' ? 'Prosedyre' : key === 'serviceArea' ? 'Tjenesteområde' : key === 'market' ? 'Marked' : 'Terskelverdi'}
              </span>
              <div>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Provisions — the signature element */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: T.ink3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Bestemmelser
          </span>
          <span style={{ fontSize: 10, color: T.ink4 }}>
            — ordlyd hentet fra databasen
          </span>
          <span style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.confirm }}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 5L4 7L8 3" stroke={T.confirm} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
            Verifisert mot lovtekst
          </div>
        </div>

        {s.provisions.map(prov => (
          <ProvisionRow key={prov.id} prov={prov} />
        ))}

        {/* Key connection note */}
        <div style={{
          marginTop: 8, padding: '8px 12px', borderRadius: 5,
          borderLeft: `3px solid ${T.aiBorder}`,
          background: 'rgba(139,105,20,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
              background: T.highlight, border: `1px solid ${T.aiBorder}`, color: T.ai,
            }}>AI</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: T.ai }}>Nøkkelkobling</span>
          </div>
          <div style={{ fontSize: 12, lineHeight: '1.55', color: T.ink2 }}>
            § 16-12 krever «objektive og ikke-diskriminerende kriterier» — disse må forankres i kvalifikasjonskravene (§ 16-5, jf. art. 58) og dokumenteres iht. § 16-6. Utvelgelseskriterier er i praksis en <em>rangering</em> av kvalifiserte leverandører basert på de samme dimensjonene som kvalifikasjonskravene.
          </div>
        </div>
      </div>

      {/* Search strategy */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: T.ink3, letterSpacing: '0.05em',
          textTransform: 'uppercase', marginBottom: 8,
        }}>Søkestrategi</div>

        {[
          { label: 'Referansetabell', items: s.searchStrategy.refTable, type: 'ref' },
          { label: 'Fulltekstsøk', items: s.searchStrategy.fts, type: 'fts' },
          { label: 'Vektorsøk', items: s.searchStrategy.vector, type: 'vec' },
          { label: 'Forarbeider', items: s.searchStrategy.prepWork, type: 'prep' },
        ].map(group => (
          <div key={group.label} style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: group.type === 'ref' ? T.ink : group.type === 'fts' ? T.ink2 : group.type === 'vec' ? T.ink3 : T.ink4,
              }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: T.ink2 }}>{group.label}</span>
            </div>
            {group.items.map((item, i) => (
              <div key={i} style={{
                padding: '4px 8px 4px 20px',
                fontSize: 12, color: T.ink2,
                fontStyle: group.type === 'vec' ? 'italic' : 'normal',
              }}>{item}</div>
            ))}
          </div>
        ))}
      </div>

      {/* AI reasoning — collapsible */}
      <details style={{ marginBottom: 24 }}>
        <summary style={{
          fontSize: 11, color: T.ink4, cursor: 'pointer',
          padding: '6px 0', userSelect: 'none',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
            background: T.highlight, border: `1px solid ${T.aiBorder}`, color: T.ai,
          }}>AI</span>
          Vis begrunnelse for forslaget
        </summary>
        <div style={{
          padding: '10px 12px', marginTop: 4, borderRadius: 5,
          background: 'rgba(139,105,20,0.03)',
          borderLeft: `3px solid ${T.aiBorder}`,
          fontSize: 12.5, lineHeight: '1.6', color: T.ink2,
        }}>
          {s.reasoning}
        </div>
      </details>

      {/* Actions */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 0',
        borderTop: `1px solid ${T.border}`,
      }}>
        <button onClick={onApprove} style={{
          padding: '10px 24px', borderRadius: 6,
          background: T.ink, color: T.panel, border: 'none',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'opacity 0.12s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Godkjenn og start søk
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7H11M11 7L8 4M11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button style={{
          padding: '10px 16px', borderRadius: 6,
          background: 'transparent', color: T.ink2,
          border: `1px solid ${T.borderM}`,
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>
          Be Claude revidere
        </button>

        <span style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: T.ink4 }}>
          Alt over kan redigeres — klikk på teksten
        </span>
      </div>
    </div>
  );
}

function SearchingPhase() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{
        width: 40, height: 40, margin: '0 auto 16px',
        borderRadius: '50%', border: `2px solid ${T.borderM}`,
        borderTopColor: T.kofa,
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
        Kjører primærsøk
      </div>
      <div style={{ fontSize: 13, color: T.ink3, marginBottom: 20 }}>
        Referansetabell · Fulltekstsøk · Vektorsøk · Forarbeider
      </div>

      {/* Progress indicators */}
      <div style={{
        display: 'inline-flex', flexDirection: 'column', gap: 6,
        textAlign: 'left',
      }}>
        {[
          { label: 'Referansetabell — § 16-12', status: 'done', count: '5 saker' },
          { label: 'Interseksjon — § 16-12 ∩ § 16-5', status: 'done', count: '3 saker' },
          { label: 'FTS «utvelgelseskriterier»', status: 'done', count: '15 saker' },
          { label: 'Vektorsøk — konseptuelt', status: 'running', count: '' },
          { label: 'Forarbeider', status: 'pending', count: '' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: item.status === 'done' ? T.ink2 : item.status === 'running' ? T.kofa : T.ink4,
          }}>
            {item.status === 'done' && (
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M3 6L5 8L9 4" stroke={T.confirm} strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            )}
            {item.status === 'running' && (
              <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${T.borderM}`, borderTopColor: T.kofa, animation: 'spin 0.8s linear infinite' }} />
            )}
            {item.status === 'pending' && (
              <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${T.borderM}` }} />
            )}
            <span>{item.label}</span>
            {item.count && <span style={{ fontFamily: "'Söhne Mono', monospace", fontSize: 11, color: T.ink3 }}>{item.count}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════ MAIN ═══════════════ */

export default function ScopingFlow() {
  const [phase, setPhase] = useState('input');

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      color: T.ink,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 24px',
        borderBottom: `1px solid ${T.border}`,
        background: T.panel,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em' }}>Paragraf</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.ink3 }}>Helene Johansen</span>
      </div>

      {/* Step indicator */}
      <StepIndicator
        steps={['Problemstilling', 'Scoping', 'Søk', 'Kandidater']}
        activeStep={phase === 'input' ? 0 : phase === 'proposal' ? 1 : phase === 'searching' ? 2 : 3}
      />

      {/* Phase content */}
      {phase === 'input' && <InputPhase onSubmit={() => setPhase('proposal')} />}
      {phase === 'proposal' && <ProposalPhase onApprove={() => setPhase('searching')} />}
      {phase === 'searching' && <SearchingPhase />}
    </div>
  );
}
