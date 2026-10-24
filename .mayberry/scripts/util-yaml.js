// YAML subset per AD-4: nested maps, `- item` lists (of scalars and maps),
// scalars (null/bool/number/quoted string), whole-line `#` comments.
// Round-trip is lossless for everything the subset accepts; comments are
// formatting, not data, and do not survive. Sole parse/serialize route for
// pack YAML.

/**
 * @typedef {Record<string, unknown>} YamlMap
 */

/**
 * Parse a YAML subset document into a nested plain-object map.
 * @param {string} text
 * @returns {YamlMap}
 * @throws {Error} one-line `util-yaml:` reason naming the offending line
 */
export function parseYaml(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    // A tab inside a quoted scalar is data, not indentation — expanding it
    // would silently change the value; refuse instead.
    if (/"[^"\r\n]*\t[^"\r\n]*"/.test(raw)) {
      throw new Error('util-yaml: tab inside a quoted scalar is not representable');
    }
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    lines.push({ indent: line.length - line.trimStart().length, text: trimmed });
  }
  let pos = 0;

  /**
   * Parse the block starting at lines[pos]: a list or a map.
   * @param {number} indent
   * @returns {unknown}
   */
  function parseBlock(indent) {
    const line = lines[pos];
    if (line.text === '-' || line.text.startsWith('- ')) {
      return parseList(line.indent);
    }
    return parseMap(indent);
  }

  /**
   * @param {number} indent
   * @returns {YamlMap}
   */
  function parseMap(indent) {
    /** @type {YamlMap} */
    const obj = {};
    while (pos < lines.length) {
      const line = lines[pos];
      if (line.indent < indent) break;
      if (line.indent > indent) {
        throw new Error(`util-yaml: unexpected indent on line: ${line.text}`);
      }
      const match = /^(.+?):\s*(.*)$/.exec(line.text);
      if (!match) {
        throw new Error(`util-yaml: cannot parse line: ${line.text}`);
      }
      const key = match[1].trim();
      if (key === '-' || key.startsWith('- ')) {
        // A list marker is not a map key, whatever the key regex swallowed.
        throw new Error(`util-yaml: cannot parse line: ${line.text}`);
      }
      pos += 1;
      if (Object.hasOwn(obj, key)) {
        throw new Error(`util-yaml: duplicate key: ${key}`);
      }
      obj[key] = parseEntryValue(indent, match[2]);
    }
    return obj;
  }

  /**
   * Value of a `key:` entry: inline scalar, nested block, or a list at the
   * entry's own indent (`skills:\n- a`) or deeper.
   * @param {number} keyIndent
   * @param {string} inline
   * @returns {unknown}
   */
  function parseEntryValue(keyIndent, inline) {
    if (inline !== '') return parseScalar(inline);
    const next = lines[pos];
    if (!next) return {};
    if ((next.text === '-' || next.text.startsWith('- ')) && next.indent >= keyIndent) {
      return parseList(next.indent);
    }
    if (next.indent > keyIndent) return parseBlock(next.indent);
    return {};
  }

  /**
   * @param {number} indent
   * @returns {unknown[]}
   */
  function parseList(indent) {
    const arr = [];
    while (pos < lines.length) {
      const line = lines[pos];
      if (line.indent < indent) break;
      if (!(line.text === '-' || line.text.startsWith('- '))) {
        if (line.indent > indent) {
          throw new Error(`util-yaml: cannot parse line: ${line.text}`);
        }
        // A sibling entry at the list's own indent ends the list; hand
        // control back to the enclosing map.
        break;
      }
      if (line.indent > indent) {
        throw new Error(`util-yaml: unexpected indent on line: ${line.text}`);
      }
      const rest = line.text === '-' ? '' : line.text.slice(2).trim();
      if (rest === '') {
        pos += 1;
        const next = lines[pos];
        arr.push(next && next.indent > indent ? parseBlock(next.indent) : null);
        continue;
      }
      pos += 1;
      if (rest === '-' || rest.startsWith('- ')) {
        // Nested list item: re-anchor the content two columns deeper so the
        // same block parser handles it.
        lines.splice(pos, 0, { indent: indent + 2, text: rest });
        arr.push(parseList(indent + 2));
      } else if (/^([^:]+):(?:\s+(.*))?$/.test(rest)) {
        // Map item (`- name: foo` plus continuation lines): re-anchor the
        // whole entry two columns deeper (where continuations already sit).
        lines.splice(pos, 0, { indent: indent + 2, text: rest });
        arr.push(parseMap(indent + 2));
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return arr;
  }

  if (lines.length === 0) return {};
  const root = parseBlock(lines[0].indent);
  if (pos < lines.length) {
    throw new Error(`util-yaml: cannot parse line: ${lines[pos].text}`);
  }
  if (Array.isArray(root)) {
    throw new Error('util-yaml: top level must be a map, not a list');
  }
  return /** @type {YamlMap} */ (root);
}

/**
 * Serialize a nested plain-object map as the YAML subset.
 * @param {YamlMap} map
 * @returns {string}
 */
export function serializeYaml(map) {
  if (map === null || typeof map !== 'object' || Array.isArray(map)) {
    throw new Error('util-yaml: can only serialize a top-level map');
  }
  return serializeMap(map, 0);
}

/**
 * @param {YamlMap} map
 * @param {number} depth
 * @returns {string}
 */
function serializeMap(map, depth) {
  const pad = '  '.repeat(depth);
  const parts = [];
  for (const key of Object.keys(map)) {
    const value = map[key];
    if (value === null || typeof value !== 'object') {
      parts.push(`${pad}${key}: ${formatScalar(/** @type {string|number|boolean|null} */ (value))}`);
    } else if (Array.isArray(value)) {
      parts.push(
        value.length === 0
          ? `${pad}${key}: []`
          : `${pad}${key}:\n${serializeList(value, depth + 1)}`,
      );
    } else {
      const nested = serializeMap(value, depth + 1);
      parts.push(nested ? `${pad}${key}:\n${nested}` : `${pad}${key}:`);
    }
  }
  // Empty maps have no block form; callers emit `key:` or `- {}` instead.
  return parts.length === 0 ? '' : parts.join('\n') + '\n';
}

/**
 * @param {unknown[]} arr
 * @param {number} depth
 * @returns {string}
 */
function serializeList(arr, depth) {
  const pad = '  '.repeat(depth);
  const parts = [];
  for (const item of arr) {
    if (item === null || typeof item !== 'object') {
      parts.push(`${pad}- ${formatScalar(/** @type {string|number|boolean|null} */ (item))}`);
    } else {
      const block = Array.isArray(item)
        ? serializeList(item, depth + 1)
        : serializeMap(item, depth + 1);
      // Empty containers have no block form; emit the flow form instead.
      parts.push(
        block
          ? dashInline(`${pad}- `, block)
          : `${pad}- ${Array.isArray(item) ? '[]' : '{}'}`,
      );
    }
  }
  // Empty lists have no block form; callers emit `key: []` or `- []` instead.
  return parts.length === 0 ? '' : parts.join('\n') + '\n';
}

/**
 * Replace only the first line's indentation with the `- ` prefix, keeping
 * continuation lines aligned under the item's first content column.
 * @param {string} prefix
 * @param {string} block
 * @returns {string}
 */
function dashInline(prefix, block) {
  const newline = block.indexOf('\n');
  return `${prefix}${block.slice(0, newline).trimStart()}${block.slice(newline)}`;
}

/**
 * @param {string} text
 * @returns {string|number|boolean|null|unknown[]|YamlMap}
 */
function parseScalar(text) {
  const value = text.trim();
  if (value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === '[]') return [];
  if (value === '{}') return {};
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  const doubleQuoted = /^"(.*)"$/.exec(value);
  if (doubleQuoted) {
    try {
      return JSON.parse(value);
    } catch {
      return doubleQuoted[1];
    }
  }
  const singleQuoted = /^'(.*)'$/.exec(value);
  if (singleQuoted) return singleQuoted[1];
  return value;
}

/**
 * @param {string|number|boolean|null} value
 * @returns {string}
 */
function formatScalar(value) {
  if (value === undefined) {
    throw new Error('util-yaml: cannot serialize undefined');
  }
  if (value === null) return 'null';
  if (typeof value !== 'string') return String(value);
  // Quote anything whose bare form would read back as a different value
  // (e.g. "null", "true", "123") or that carries YAML structural characters
  // (leading -, #, :, whitespace; a `: `; a trailing `:`) in any position.
  const parsed = parseScalar(value);
  const needsQuotes =
    value === '' ||
    parsed !== value ||
    /^[#:\-\s]|:\s|:$|\s$/.test(value);
  return needsQuotes ? JSON.stringify(value) : value;
}
