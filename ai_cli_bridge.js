const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.AI_BRIDGE_PORT || 8787);

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function buildBrochurePrompt(payload) {
  const {
    projectTitle = '',
    category = 'BIM',
    year = '',
    client = '',
    scope = '',
    currentSummary = '',
    currentBullets = [],
    legendCaptions = [],
    visualCount = 0,
    layoutType = '',
    styleMode = 'standard',
    targetBulletCount = 4,
    includeLegends = false,
    customFocus = '',
    previousSummary = ''
  } = payload || {};

  const styleMap = {
    standard: '눈사람공장 지명원 표준 스타일 (공백 포함 55~95자 내외의 명확하고 절제된 개조식 요약문 + 18~34자 내외의 핵심 수행 불릿)',
    concise: '핵심 압축 스타일 (공백 포함 42~68자 내외의 한눈에 읽히는 간결한 요약문 + 15~26자 내외의 단문 불릿)',
    detailed: '엔지니어링 상세 스타일 (공백 포함 70~110자 내외로 대상 시설물 특성·기술 공종·검토 성과를 구체적으로 기술한 요약문 + 22~38자 내외의 구체적 수행 불릿)',
    public: '공공·조달 제출 스타일 (발주처·조달청·설계도서 기준 준수, 정합성·간섭 검토 및 납품 성과품의 신뢰성을 강조한 격식 있는 개조식)'
  };

  const bCount = Math.max(2, Math.min(6, Number(targetBulletCount) || 4));

  return [
    '당신은 건축 BIM·3D 라이다(LiDAR) 스캐닝·역설계·디지털 트윈·공간 컴퓨팅(XR) 전문 기업 "눈사람공장(SNOWMAN FACTORY)"의 지명원(브로슈어) 수석 기술 작문가입니다.',
    '아래 프로젝트의 고유 정보(시설물 용도, 발주처, Scope, 우측 도면/비주얼 구성)를 깊이 분석하여, 해당 프로젝트에 딱 맞는 맞춤형 [요약 설명문(summary)]과 [세부 수행 내용 불릿 리스트(bullets)]' + (includeLegends ? ' 및 [이미지 범례 캡션(legends)]' : '') + '을 작성하세요.',
    '',
    '[프로젝트 컨텍스트]',
    `- 프로젝트명: ${projectTitle}`,
    `- 솔루션 분야(Category): ${category}`,
    `- 수행연도: ${year}`,
    `- 발주처(Client): ${client || '미지정'}`,
    `- 수행범위(Scope): ${scope || 'BIM / 3D Scan'}`,
    layoutType ? `- 페이지 비주얼 레이아웃: ${layoutType} (우측 이미지 ${visualCount || 3}컷 구성)` : '',
    Array.isArray(legendCaptions) && legendCaptions.length ? `- 현재 우측 이미지 범례(1~${legendCaptions.length}): ${legendCaptions.join(' | ')}` : '',
    currentSummary ? `- 현재 페이지 요약문(참고용): ${currentSummary}` : '',
    Array.isArray(currentBullets) && currentBullets.length ? `- 현재 페이지 불릿(참고용): ${currentBullets.join(' / ')}` : '',
    previousSummary ? `- 직전 생성본(이 문장과 겹치지 않게 새로운 시각/표현으로 재작성할 것): ${previousSummary}` : '',
    customFocus ? `- 사용자 추가 강조 지시사항(최우선 반영): ${customFocus}` : '',
    '',
    '[눈사람공장 실제 지명원 우수 작성 레퍼런스 (어조와 리듬 참고)]',
    '- 레퍼런스 A (BIM 전환·실시설계): summary="계획설계 도서를 기반으로 건축·구조 분야의 BIM 전환설계를 수행하고, 설계 의도를 반영한 분야별 BIM 모델 구축" / bullets=["계획설계 도서 기반 건축 BIM 모델 구축","계획설계 도서 기반 구조 BIM 모델 구축","건축·구조 분야 설계 내용 BIM 전환","분야별 BIM 모델과 설계 도서 정합성 검토"]',
    '- 레퍼런스 B (클라우드 통합 BIM·간섭검토): summary="BIM 360 클라우드 기반의 작업 환경 내에서 기본/실시설계 단계 건축, 구조 BIM 프로젝트 수행" / bullets=["건축, 구조 BIM 모델링","건축, 구조, MEP BIM 모델의 간섭검토 수행","건축, 구조 실시도면 작성"]',
    '- 레퍼런스 C (현장 3D 스캔·정합성 검토): summary="구조 시공 완료 후 설계 도서와 현장 정합성 검토 진행, 구조와 설비의 간섭 여부를 현장 데이터 기반으로 검토를 진행" / bullets=["Lidar 스캐너를 이용하여 현장 3D 스캔","CAD 도면에 근거하여 BIM 모델링 (건축, 구조, MEP 모델)","BIM 모델링과 스캔 데이터(포인트 클라우드) 정합을 통해 정합성 검토","정합성 오류 검토 보고서 작성"]',
    '- 레퍼런스 D (용도변경·그린리모델링 역설계): summary="그린리모델링 설계를 위해 사전에 3D 스캔을 통한 현장 데이터 취득 및 역설계 도면화 진행" / bullets=["Lidar 스캐너를 이용하여 현장 3D 스캔","평·단면도 CAD와 스캔 데이터 정합성 검토","스캔 데이터에 근거하여 건축 외피 및 주요 부위 BIM 역설계","평·입·단면도 추출 및 실시설계 CAD 도면 작성"]',
    '',
    '[작성 규칙 - 반드시 준수]',
    `1. 문체 및 톤앤매너: ${styleMap[styleMode] || styleMap.standard}`,
    '2. 프로젝트 고유성 반영: 프로젝트명에서 드러나는 시설물 특성(예: 병원/의료시설, 데이터센터, 경찰/기동대/보훈회관/청사 등 공공시설, 공장/산업시설, 호텔/숙박시설, 경로당/보건소 그린리모델링, 장학관/교육시설, 대학 강의/컨설팅, 네옴시티/인프라 등)과 Scope(계획설계/실시설계/전환설계/3D 스캔/역설계/정합성 검토/XR/시뮬레이션)를 문장에 자연스럽게 녹여내세요.',
    '3. summary(요약 설명문): 마침표(.) 없이 명사형/개조식(예: "...구축", "...수행", "...진행", "...검토")으로 끝나는 1개의 완결된 문장으로 작성하세요. 줄바꿈(\\n)이나 HTML 태그를 넣지 마세요.',
    `4. bullets(세부 수행 항목): 정확히 ${bCount}개의 항목으로 작성하세요. 각 항목은 앞에 불릿 기호(•, -, 1. 등) 없이 순수 텍스트로만 작성하고, 과업의 흐름(데이터 취득/도서 분석 → 모델링/정합 → 간섭/정합성 검토 → 도면화/보고서/성과품 도출)이 논리적 순서로 이어지게 구성하세요.`,
    includeLegends
      ? `5. legends(우측 이미지 범례 캡션): 우측 이미지 ${Math.max(1, Number(visualCount) || 3)}컷에 대응하는 간결한 도면/비주얼 캡션(각 6~18자 내외, 예: "BIM 모델 ISO", "스캔 데이터 & CAD 정합 검토", "건축·구조 단면도", "MEP 간섭 검토(Navisworks)")을 배열로 함께 작성하세요.`
      : '',
    '6. 코드 블록(```json)이나 인사말, 부연 설명 없이 오직 아래 순수 JSON 객체 하나만 출력하세요:',
    includeLegends
      ? '{"summary":"요약 설명문 텍스트","bullets":["수행항목1","수행항목2"],"legends":["범례1","범례2"]}'
      : '{"summary":"요약 설명문 텍스트","bullets":["수행항목1","수행항목2","수행항목3","수행항목4"]}'
  ].filter(Boolean).join('\n');
}

function extractJsonFromText(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('CLI 응답이 비어 있습니다.');

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.bullets)) {
      const out = {
        summary: parsed.summary.replace(/\s+/g, ' ').trim(),
        bullets: parsed.bullets
          .map(b => String(b || '').replace(/^[•·\-\*\d+\.)]\s*/, '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
      };
      if (Array.isArray(parsed.legends)) {
        out.legends = parsed.legends
          .map(l => String(l || '').replace(/^\d+\.\s*/, '').trim())
          .filter(Boolean);
      }
      return out;
    }
  }
  throw new Error('JSON 파싱 실패: ' + text.slice(0, 200));
}

function runCodexCli(promptText, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `snowman_codex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.txt`);
    const args = [
      '/c',
      'codex',
      'exec',
      '--ignore-user-config',
      '--skip-git-repo-check',
      '--ephemeral',
      '-s',
      'read-only',
      '-o',
      tmpFile,
      '-'
    ];

    const child = spawn('cmd.exe', args, {
      cwd: __dirname,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch (e) {}
      reject(new Error('Codex CLI 응답 시간 초과 (45초)'));
    }, timeoutMs);

    child.stdout.on('data', d => { stdout += d.toString('utf8'); });
    child.stderr.on('data', d => { stderr += d.toString('utf8'); });

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', code => {
      clearTimeout(timer);
      let outputText = '';
      try {
        if (fs.existsSync(tmpFile)) {
          outputText = fs.readFileSync(tmpFile, 'utf8');
          fs.unlinkSync(tmpFile);
        }
      } catch (e) {}

      if (!outputText.trim()) {
        outputText = stdout;
      }

      try {
        const result = extractJsonFromText(outputText);
        resolve({ ...result, engine: 'codex' });
      } catch (err) {
        reject(new Error(`Codex 실행 오류 (code=${code}): ${err.message} ${stderr.slice(0, 160)}`));
      }
    });

    child.stdin.write(promptText, 'utf8');
    child.stdin.end();
  });
}

function runClaudeCli(promptText, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const claudeBin = fs.existsSync('C:\\Users\\snow\\.local\\bin\\claude.exe')
      ? 'C:\\Users\\snow\\.local\\bin\\claude.exe'
      : 'claude';

    const child = spawn(claudeBin, ['-p'], {
      cwd: __dirname,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch (e) {}
      reject(new Error('Claude CLI 응답 시간 초과 (45초)'));
    }, timeoutMs);

    child.stdout.on('data', d => { stdout += d.toString('utf8'); });
    child.stderr.on('data', d => { stderr += d.toString('utf8'); });

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', code => {
      clearTimeout(timer);
      try {
        const result = extractJsonFromText(stdout);
        resolve({ ...result, engine: 'claude' });
      } catch (err) {
        reject(new Error(`Claude CLI 실행 오류 (code=${code}): ${err.message} ${stderr.slice(0, 160)}`));
      }
    });

    child.stdin.write(promptText, 'utf8');
    child.stdin.end();
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      defaultEngine: 'codex',
      availableEngines: ['codex', 'claude'],
      port: PORT
    }));
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/api/generate-project-desc')) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString('utf8'); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const engine = (payload.engine || 'codex').toLowerCase();
        const promptText = buildBrochurePrompt(payload);

        console.log(`[AI Bridge] Generating via [${engine.toUpperCase()}] for project: ${payload.projectTitle || 'Untitled'} (style=${payload.styleMode || 'standard'}, bullets=${payload.targetBulletCount || 4})`);
        let result;
        if (engine === 'claude') {
          result = await runClaudeCli(promptText);
        } else {
          result = await runCodexCli(promptText);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (err) {
        console.error('[AI Bridge] Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`=============================================================`);
  console.log(` SNOWMAN FACTORY Local LLM CLI Bridge Server Running`);
  console.log(` URL: http://127.0.0.1:${PORT}`);
  console.log(` Default Engine: Codex CLI (codex exec)`);
  console.log(`=============================================================`);
});
