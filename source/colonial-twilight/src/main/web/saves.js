const saveFormat = 'colonial-twilight-fln';
const saveVersion = 1;
const engineVersion = 'coltwi-v2.16-web-1';
const scenarios = new Set(['Short', 'Medium', 'Full']);

function readSave(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Choose a valid JSON save file.');
  }

  if (data && Object.hasOwn(data, 'format')) {
    if (data.format !== saveFormat) throw new Error('Choose a Colonial Twilight save.');
    if (data.version !== saveVersion) throw new Error('This save requires a different save format version.');
    if (data.engineVersion !== engineVersion) throw new Error('This save requires a different version of the FLN engine.');
    data = data.session;
  }

  if (!scenarios.has(data?.scenario) || typeof data.finalSupport !== 'boolean'
    || !Number.isInteger(data.seed) || (data.seed | 0) !== data.seed
    || !Array.isArray(data.inputs) || !data.inputs.every((input) => typeof input === 'string')) {
    throw new Error('This save has missing or invalid game data.');
  }

  const { scenario, finalSupport, seed, inputs } = data;
  return { scenario, finalSupport, seed, inputs };
}

function writeSave(session) {
  return JSON.stringify({ format: saveFormat, version: saveVersion, engineVersion, session });
}
