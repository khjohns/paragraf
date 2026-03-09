import { useState, useRef, useEffect } from "react";

/* ═══════════════ TOKENS ═══════════════ */
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
  kofa: '#8B6914',
  kofaBg: '#F0EBD8',
  eu: '#2D6A5D',
  prov: '#4A6670',
  ai: '#8B6914',
  aiBg: 'rgba(139,105,20,0.04)',
  aiBorder: 'rgba(139,105,20,0.2)',
  highlight: '#FBF5E8',
  warn: '#A67B2E',
  warnBg: '#FBF5E8',
  success: '#3D7A4A',
  successBg: '#EBF5ED',
  challenge: '#7A5C2E',
  challengeBg: 'rgba(122,92,46,0.04)',
  challengeBorder: 'rgba(122,92,46,0.18)',
  suggestion: 'rgba(26,24,20,0.025)',
  suggestionBorder: 'rgba(26,24,20,0.1)',
};

/* ═══════════════ MOCK CONVERSATION ═══════════════ */
const MESSAGES = [
  {
    role: 'user',
    text: 'Jeg ser en motstrid mellom 2023/456 og 2022/789 om tidspunktet for forpliktelseserklæring. I den første krever nemnda at den foreligger ved tilbudsfristen, i den andre aksepteres ettersending. Hva skiller sakene?',
  },
  {
    role: 'assistant',
    blocks: [
      {
        type: 'text',
        content: 'Det er en reell spenning, men det er en viktig nyanseforskjell i faktum som kan forklare den.',
      },
      {
        type: 'text',
        content: 'I {ref:kofa:2023/456:§42} hadde tilbyderen *kun* vedlagt ESPD-skjema fra den støttende virksomheten. Nemnda slo fast at ESPD dokumenterer at virksomheten oppfyller kvalifikasjonskrav, men ikke at leverandøren råder over ressursene. To ulike spørsmål.',
      },
      {
        type: 'text',
        content: 'I {ref:kofa:2022/789:§38} hadde tilbyderen vedlagt detaljert beskrivelse av samarbeidet, kontaktinformasjon, referanser og en intensjonsavtale — men manglet den formelle forpliktelseserklæringen. Nemnda fant at tilbudet inneholdt «tilstrekkelig informasjon» til å vurdere rådighet.',
      },
      {
        type: 'text',
        content: 'Skillet ser ut til å være: ren ESPD uten tilleggsdokumentasjon → avvisning. Substansiell dokumentasjon som faktisk belyser rådighetsforholdet, men uten formell erklæring → ettersending aksepteres.',
      },
      {
        type: 'challenge',
        content: 'Denne lesningen er imidlertid ikke uproblematisk. {ref:kofa:2022/789:§39} presiserer eksplisitt at dette «ikke innebærer at forpliktelseserklæring generelt kan utelates». Formuleringen kan tolkes som at nemnda selv er klar over spenningen. Det er også verdt å merke seg at {ref:kofa:2018/123} — den mest siterte saken i dette rettskildebildet med 12 siteringer — ikke tar stilling til tidspunktspørsmålet direkte. Du har ikke lest den ennå.',
      },
    ],
  },
  {
    role: 'user',
    text: 'Finnes det saker der nemnda eksplisitt drøfter forholdet mellom disse to tilnærmingene?',
  },
  {
    role: 'assistant',
    blocks: [
      {
        type: 'text',
        content: 'Ikke direkte. Ingen av sakene i ditt nåværende søk refererer hverandre om akkurat dette spørsmålet. Det er i seg selv et funn — spenningen er ikke adressert av nemnda.',
      },
      {
        type: 'text',
        content: 'Jeg søkte bredere i avgjørelsestekstene via vektor og fant én kandidat som ikke er i ditt nåværende søkeresultat:',
      },
      {
        type: 'newcase',
        caseId: '2024/112',
        title: 'Forpliktelseserklæring — helhetsvurdering',
        date: '2024-03-08',
        outcome: 'Ikke brudd',
        snippet: 'Nemnda uttaler i avsnitt 29 at «spørsmålet om forpliktelseserklæring beror på en konkret vurdering av den samlede dokumentasjonen i tilbudet».',
        relevance: 'Kan representere en konsolidering av de to tilnærmingene',
      },
      {
        type: 'text',
        content: 'Denne saken er fra 2024 og kan representere gjeldende praksis. Den formulerer et vilkår som rommer begge de tidligere tilnærmingene. Vil du legge den til i analysen?',
      },
    ],
  },
];

/* Unsolicited suggestion - appears after 8+ cases read */
const SUGGESTION = {
  type: 'proactive',
  content: 'Basert på dine notater ser det ut til at du har identifisert et mønster om at dokumentasjonskravene varierer etter type kvalifikasjonskrav (kompetanse vs. kapasitet). Jeg fant 2 saker du ikke har lest som kan utfordre dette:',
  cases: [
    { id: '2021/567', title: 'Kapasitetskrav — strengere dokumentasjon', relevance: 'Motstridende: nemnda krever forpliktelseserklæring selv med øvrig dokumentasjon' },
    { id: '2020/891', title: 'Kompetansekrav — ESPD akseptert', relevance: 'Kan svekke skillet du har identifisert' },
  ],
};

/* ═══════════════ REF PARSER ═══════════════ */
function parseRefs(text, onRefClick) {
  const parts = [];
  let remaining = text;
  const refRegex = /\{ref:(\w+):([^:}]+)(?::([^}]+))?\}/g;
  let match;
  let lastIndex = 0;

  const allMatches = [];
  while ((match = refRegex.exec(text)) !== null) {
    allMatches.push({ index: match.index, length: match[0].length, type: match[1], id: match[2], paragraph: match[3] });
  }

  if (allMatches.length === 0) {
    // Handle markdown-style bold
    return renderMarkdown(text, onRefClick);
  }

  allMatches.forEach((m, i) => {
    if (m.index > lastIndex) {
      parts.push(...renderMarkdown(remaining.slice(lastIndex, m.index)));
    }
    const label = m.paragraph ? `${m.id} ${m.paragraph}` : m.id;
    const color = m.type === 'kofa' ? T.kofa : m.type === 'eu' ? T.eu : T.prov;
    parts.push(
      <span key={`ref-${i}`} onClick={() => onRefClick && onRefClick(m)} style={{
        fontFamily: "'Söhne Mono', 'IBM Plex Mono', monospace",
        fontWeight: 600, color, cursor: 'pointer',
        borderBottom: `1px solid transparent`,
        transition: 'border-color 0.15s ease',
        paddingBottom: 1,
      }}
      onMouseEnter={e => e.currentTarget.style.borderBottomColor = color}
      onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
      >{label}</span>
    );
    lastIndex = m.index + m.length;
  });

  if (lastIndex < remaining.length) {
    parts.push(...renderMarkdown(remaining.slice(lastIndex)));
  }
  return parts;
}

function renderMarkdown(text) {
  const parts = [];
  const boldRegex = /\*([^*]+)\*/g;
  let lastIdx = 0;
  let m;
  const matches = [];
  while ((m = boldRegex.exec(text)) !== null) {
    matches.push({ index: m.index, length: m[0].length, inner: m[1] });
  }
  if (matches.length === 0) return [text];
  matches.forEach((match, i) => {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    parts.push(<em key={`em-${i}`} style={{ fontStyle: 'italic', color: T.ink }}>{match.inner}</em>);
    lastIdx = match.index + match.length;
  });
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

/* ═══════════════ CHAT COMPONENTS ═══════════════ */

function UserMessage({ text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
      <div style={{
        maxWidth: '85%', padding: '12px 16px', borderRadius: '14px 14px 4px 14px',
        background: T.ink, color: '#F5F3EE',
        fontSize: 14, lineHeight: '1.6', fontWeight: 400,
        letterSpacing: '-0.01em',
      }}>
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ blocks, onRefClick }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 20 }}>
      <div style={{ maxWidth: '90%' }}>
        {blocks.map((block, i) => {
          if (block.type === 'text') {
            return (
              <p key={i} style={{
                margin: '0 0 10px', padding: 0,
                fontSize: 14, lineHeight: '1.65', color: T.ink,
                letterSpacing: '-0.01em',
              }}>
                {parseRefs(block.content, onRefClick)}
              </p>
            );
          }

          if (block.type === 'challenge') {
            return (
              <div key={i} style={{
                margin: '12px 0 10px', padding: '12px 14px', borderRadius: 6,
                borderLeft: `3px solid ${T.challengeBorder}`,
                background: T.challengeBg,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                    color: T.challenge, textTransform: 'uppercase',
                  }}>Mulige motargumenter</span>
                </div>
                <p style={{
                  margin: 0, fontSize: 13.5, lineHeight: '1.6', color: T.ink2,
                }}>
                  {parseRefs(block.content, onRefClick)}
                </p>
              </div>
            );
          }

          if (block.type === 'newcase') {
            return (
              <div key={i} onClick={() => onRefClick && onRefClick({ type: 'kofa', id: block.caseId })}
                style={{
                  margin: '10px 0 12px', padding: '12px 14px', borderRadius: 6,
                  background: T.surface, border: `1px solid ${T.borderM}`,
                  cursor: 'pointer', transition: 'border-color 0.12s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.borderS}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.borderM}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.kofa, opacity: 0.8 }} />
                  <span style={{ fontFamily: "'Söhne Mono', monospace", fontWeight: 700, fontSize: 13, color: T.kofa }}>{block.caseId}</span>
                  <span style={{ fontSize: 11, color: T.ink3 }}>{block.date}</span>
                  <span style={{
                    padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                    background: block.outcome === 'Brudd' ? T.warnBg : T.successBg,
                    color: block.outcome === 'Brudd' ? T.warn : T.success,
                  }}>{block.outcome}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 4 }}>{block.title}</div>
                <div style={{ fontSize: 12.5, lineHeight: '1.55', color: T.ink2, fontStyle: 'italic' }}>«{block.snippet}»</div>
                <div style={{
                  marginTop: 8, display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, color: T.ai, fontWeight: 500,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                    background: T.highlight, border: `1px solid ${T.aiBorder}`,
                  }}>AI</span>
                  {block.relevance}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function ProactiveSuggestion({ suggestion, onRefClick, onDismiss }) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div style={{
        margin: '12px 0', padding: '8px 14px', borderRadius: 6,
        background: T.suggestion, border: `1px solid ${T.suggestionBorder}`,
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: 'pointer', fontSize: 12, color: T.ink3,
      }} onClick={() => setCollapsed(false)}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: T.highlight, border: `1px solid ${T.aiBorder}`, color: T.ai }}>AI</span>
        Forslag basert på dine notater — klikk for å utvide
      </div>
    );
  }

  return (
    <div style={{
      margin: '12px 0', padding: '14px 16px', borderRadius: 8,
      background: T.suggestion, border: `1px solid ${T.suggestionBorder}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: T.highlight, border: `1px solid ${T.aiBorder}`, color: T.ai,
          }}>AI</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: T.ink3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Ubedt observasjon</span>
        </div>
        <button onClick={() => setCollapsed(true)} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 13, color: T.ink4, padding: '2px 4px',
        }}>×</button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: '1.6', color: T.ink2 }}>{suggestion.content}</p>

      {suggestion.cases.map((c, i) => (
        <div key={i} onClick={() => onRefClick && onRefClick({ type: 'kofa', id: c.id })}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '8px 10px', borderRadius: 5, marginBottom: 4,
            background: T.surface, border: `1px solid ${T.border}`,
            cursor: 'pointer', transition: 'border-color 0.12s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = T.borderS}
          onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.kofa, opacity: 0.8, marginTop: 4, flexShrink: 0 }} />
          <div>
            <span style={{ fontFamily: "'Söhne Mono', monospace", fontWeight: 600, fontSize: 12, color: T.kofa }}>{c.id}</span>
            <span style={{ fontSize: 11, color: T.ink3, marginLeft: 6 }}>{c.title}</span>
            <div style={{ fontSize: 11, color: T.ink3, marginTop: 2, fontStyle: 'italic' }}>{c.relevance}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════ INPUT ═══════════════ */
function ChatInput({ onSend }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  return (
    <div style={{
      padding: '12px 16px', borderTop: `1px solid ${T.border}`,
      background: T.panel,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: T.input, border: `1px solid ${T.borderM}`,
        transition: 'border-color 0.15s ease',
      }}
      >
        <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
          placeholder="Still et spørsmål om rettskildebildet…"
          rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) { onSend(text); setText(''); } } }}
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontSize: 14, lineHeight: '1.5', color: T.ink, resize: 'none',
            fontFamily: 'inherit', padding: 0, maxHeight: 120,
          }}
        />
        <button onClick={() => { if (text.trim()) { onSend(text); setText(''); } }}
          style={{
            width: 30, height: 30, borderRadius: 8, border: 'none',
            background: text.trim() ? T.ink : 'transparent',
            color: text.trim() ? T.panel : T.ink4,
            cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease', flexShrink: 0,
          }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 13L13 8L3 3V7L9 8L3 9V13Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════ DRAWER ═══════════════ */
function ChatDrawer({ drawerState, setDrawerState, onRefClick }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [drawerState]);

  if (drawerState === 'closed') {
    return (
      <div
        onClick={() => setDrawerState('half')}
        style={{
          height: 40, borderTop: `1px solid ${T.border}`,
          background: T.panel,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', transition: 'background 0.12s ease',
          userSelect: 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.background = T.surface}
        onMouseLeave={e => e.currentTarget.style.background = T.panel}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 10L8 6L12 10" stroke={T.ink3} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 500, color: T.ink3, letterSpacing: '0.02em' }}>Sparring</span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: T.ai, opacity: 0.6,
        }} />
      </div>
    );
  }

  const isHalf = drawerState === 'half';
  const height = isHalf ? '45%' : '100%';

  return (
    <div style={{
      height, borderTop: `1px solid ${T.borderM}`,
      background: T.panel,
      display: 'flex', flexDirection: 'column',
      transition: 'height 0.25s ease',
    }}>
      {/* Drag handle + controls */}
      <div style={{
        padding: '6px 16px', display: 'flex', alignItems: 'center',
        borderBottom: `1px solid ${T.border}`,
        cursor: 'pointer', userSelect: 'none',
        flexShrink: 0,
      }}>
        {/* Drag indicator */}
        <div style={{
          width: 32, height: 3, borderRadius: 2, background: T.borderS,
          margin: '0 auto',
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.ink2, letterSpacing: '0.02em' }}>Sparring</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: T.highlight, border: `1px solid ${T.aiBorder}`, color: T.ai,
          }}>AI</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Size toggle */}
        <button onClick={() => setDrawerState(isHalf ? 'full' : 'half')}
          title={isHalf ? 'Utvid' : 'Halv'}
          style={{
            width: 24, height: 24, borderRadius: 4, border: `1px solid ${T.border}`,
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.ink3,
            marginRight: 4,
          }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {isHalf ? (
              <><line x1="2" y1="2" x2="10" y2="2" stroke="currentColor" strokeWidth="1.2" /><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.2" /><line x1="2" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" /></>
            ) : (
              <><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" /><line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="1.5" /></>
            )}
          </svg>
        </button>

        {/* Close */}
        <button onClick={() => setDrawerState('closed')}
          style={{
            width: 24, height: 24, borderRadius: 4, border: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.ink4, fontSize: 15,
          }}>×</button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
      }}>
        {/* Proactive suggestion */}
        <ProactiveSuggestion suggestion={SUGGESTION} onRefClick={onRefClick} />

        {MESSAGES.map((msg, i) => (
          msg.role === 'user'
            ? <UserMessage key={i} text={msg.text} />
            : <AssistantMessage key={i} blocks={msg.blocks} onRefClick={onRefClick} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={(text) => console.log('Send:', text)} />
    </div>
  );
}

/* ═══════════════ MINIMAL WORKSPACE CONTEXT ═══════════════ */
function WorkspaceStrip() {
  return (
    <div style={{
      padding: '10px 16px',
      background: T.bg,
      display: 'flex', alignItems: 'center', gap: 8,
      borderBottom: `1px solid ${T.border}`,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Paragraf</span>
      <span style={{ color: T.borderS }}>·</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>FOA §16-10 — Rådighet</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: T.ink3 }}>4 av 8 lest</span>
      <span style={{ color: T.borderS }}>·</span>
      <span style={{ fontSize: 11, color: T.ink3 }}>Iterasjon 2</span>
    </div>
  );
}

/* Minimal hint of the list above the chat */
function ListHint({ activeRef }) {
  const items = [
    { id: '2023/456', cat: 'A', sub: 'ESPD + støttende virksomhet', outcome: 'Brudd' },
    { id: '2022/789', cat: 'A', sub: 'Forpliktelseserklæring — tidspunkt', outcome: 'Ikke brudd' },
    { id: '2021/234', cat: 'B', sub: 'Kvantitativ kapasitet', outcome: 'Brudd' },
    { id: '2018/123', cat: 'A', sub: 'Rådighet og likebehandling', outcome: 'Brudd' },
  ];
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: T.bg }}>
      {items.map(item => {
        const isActive = activeRef === item.id;
        return (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 16px',
            borderBottom: `1px solid ${T.border}`,
            borderLeft: `3px solid ${isActive ? T.kofa : 'transparent'}`,
            background: isActive ? T.active : 'transparent',
            transition: 'all 0.15s ease',
          }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${T.borderS}`, flexShrink: 0 }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: T.kofa, opacity: 0.7, flexShrink: 0 }} />
            <span style={{ fontFamily: "'Söhne Mono', monospace", fontWeight: 600, fontSize: 12, color: T.ink }}>{item.id}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 4px', borderRadius: 3,
              background: 'rgba(26,24,20,0.06)', color: T.ink2,
            }}>{item.cat}</span>
            <span style={{ fontSize: 11, color: T.ink2, flex: 1 }}>{item.sub}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
              background: item.outcome === 'Brudd' ? T.warnBg : T.successBg,
              color: item.outcome === 'Brudd' ? T.warn : T.success,
            }}>{item.outcome}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════ MAIN ═══════════════ */
export default function ChatPanelConcept() {
  const [drawerState, setDrawerState] = useState('half');
  const [activeRef, setActiveRef] = useState(null);
  const [toast, setToast] = useState(null);

  const handleRefClick = (ref) => {
    const label = ref.paragraph ? `${ref.id} ${ref.paragraph}` : ref.id;
    setActiveRef(ref.id);
    setToast(`→ Åpner ${label} i høyrepanelet`);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div style={{
      height: '100vh', width: '100%',
      display: 'flex', flexDirection: 'column',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      color: T.ink, background: T.bg,
      position: 'relative',
    }}>
      <WorkspaceStrip />
      <ListHint activeRef={activeRef} />
      <ChatDrawer drawerState={drawerState} setDrawerState={setDrawerState} onRefClick={handleRefClick} />

      {/* Toast for reference clicks */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 16px', borderRadius: 8,
          background: T.ink, color: T.panel,
          fontSize: 12, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.2s ease',
          zIndex: 100,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
