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
    customFocus = ''
  } = payload || {};

  return [
    '당신은 건축 BIM·3D 라이다(LiDAR) 스캐닝·역설계·디지털 트윈 전문 기업 "눈사람공장(SNOWMAN FACTORY)"의 지명원(브로슈어) 기술 작문 전문가입니다.',
    '아래 프로젝트 정보를 바탕으로 프로젝트 소개 페이지 좌측 하단에 들어갈 [요약 설명문(summary)]과 [세부 수행 내용 불릿 리스트(bullets)]를 작성하세요.',
    '',
    '[프로젝트 정보]',
    `- 프로젝트명: ${projectTitle}`,
    `- 분야(Category): ${category}`,
    `- 수행연도: ${year}`,
    `- 발주처(Client): ${client}`,
    `- 수행범위(Scope): ${scope}`,
    currentSummary ? `- 현재 요약문(참고용): ${currentSummary}` : '',
    Array.isArray(currentBullets) && currentBullets.length ? `- 현재 불릿(참고용): ${currentBullets.join(' / ')}` : '',
    customFocus ? `- 추가 강조 요청사항: ${customFocus}` : '',
    '',
    '[작성 규칙 - 매우 중요]',
    '1. summary(요약 설명문): 2~3줄 분량(공백 포함 65~115자 내외)의 간결하고 전문적인 명사형/개조식 종결 문장으로 작성하세요.',
    '   예시1: "구조 시공 완료 후 설계 도서와 현장 정합성 검토 진행, 구조와 설비의 간섭 여부를 현장 데이터 기반으로 검토를 진행"',
    '   예시2: "3D 스캔 데이터를 활용하여 실제 현장을 반영한 BIM 모델을 구축하고 리모델링 계획과 실시 설계를 진행"',
    '   예시3: "설계 도서를 기반으로 건축·구조·MEP 통합 BIM 모델을 구축하고 공종 간 사전 간섭 검토 및 시공 도서를 작성"',
    '2. bullets(세부 수행 항목): 3개 또는 4개의 핵심 수행 과업을 간결한 개조식 단문(각 항목 18~38자 내외, 앞에 불릿 기호 없이 순수 텍스트만)으로 작성하세요.',
    '   예시 항목들:',
    '   - "Lidar 스캐너를 이용하여 현장 3D 스캔"',
    '   - "CAD 도면에 근거하여 BIM 모델링 (건축, 구조, MEP 모델)"',
    '   - "BIM 모델링과 스캔 데이터(포인트 클라우드) 정합을 통해 정합성 검토"',
    '   - "정합성 오류 검토 보고서 작성"',
    '3. 반드시 코드 블록이나 부연 설명 없이 아래 순수 JSON 형식으로만 응답하세요:',
    '{"summary":"요약 설명문 텍스트","bullets":["수행항목1","수행항목2","수행항목3","수행항목4"]}'
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
      return {
        summary: parsed.summary.trim(),
        bullets: parsed.bullets.map(b => String(b || '').replace(/^[•·\-\*]\s*/, '').trim()).filter(Boolean)
      };
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

        console.log(`[AI Bridge] Generating via [${engine.toUpperCase()}] for project: ${payload.projectTitle || 'Untitled'}`);
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
