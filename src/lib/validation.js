const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ALLOWED_FIELD_TYPES = new Set(['name', 'signature', 'date', 'email', 'phone', 'other']);
const ALLOWED_VALIDATIONS = new Set(['none', 'required', 'email', 'phone', 'min2']);
const ALLOWED_STATUSES = new Set(['draft', 'active', 'archived']);
const ALLOWED_PERMISSIONS = new Set(['view', 'edit', 'manage']);
const ALLOWED_ROLES = new Set(['user', 'admin']);

function isNonEmptyString(v, { min = 1, max = 500 } = {}) {
  return typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
}

function isEmail(v) {
  return typeof v === 'string' && v.trim().length <= 254 && EMAIL_RE.test(v.trim());
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function validateSignRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body.', status: 400 };
  }
  const { documentId, fieldValues, signerEmail } = body;
  if (!isNonEmptyString(documentId, { min: 1, max: 128 })) {
    return { ok: false, error: 'documentId is required.', status: 400 };
  }
  if (!fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) {
    return { ok: false, error: 'fieldValues must be an object.', status: 400 };
  }
  const keys = Object.keys(fieldValues);
  if (keys.length > 200) {
    return { ok: false, error: 'Too many fields.', status: 400 };
  }
  for (const k of keys) {
    const val = fieldValues[k];
    if (typeof val !== 'string') {
      return { ok: false, error: `Field ${k} must be a string.`, status: 400 };
    }
    // signature data URLs can be large; cap at 200k
    if (val.length > 200_000) {
      return { ok: false, error: `Field ${k} is too large.`, status: 400 };
    }
  }
  if (signerEmail !== undefined && signerEmail !== null && signerEmail !== '') {
    if (!isEmail(signerEmail)) {
      return { ok: false, error: 'signerEmail must be a valid email address.', status: 400 };
    }
  }
  return { ok: true };
}

export function validateFieldsArray(fields) {
  if (!Array.isArray(fields)) {
    return 'fields must be an array';
  }
  if (fields.length > 100) {
    return 'Too many fields (max 100)';
  }
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      return `fields[${i}] must be an object`;
    }
    const label = f.label;
    if (!isNonEmptyString(label, { min: 1, max: 100 })) {
      return `fields[${i}].label must be 1-100 characters`;
    }
    const ft = f.field_type || f.fieldType;
    if (!ALLOWED_FIELD_TYPES.has(ft)) {
      return `fields[${i}].field_type must be one of ${[...ALLOWED_FIELD_TYPES].join(', ')}`;
    }
    for (const coord of ['x', 'y', 'width', 'height']) {
      const v = f[coord];
      if (!isFiniteNumber(v)) {
        return `fields[${i}].${coord} must be a finite number`;
      }
    }
    if (f.width < 10 || f.width > 1000) return `fields[${i}].width must be 10-1000`;
    if (f.height < 10 || f.height > 1000) return `fields[${i}].height must be 10-1000`;
    if (f.x < 0 || f.x > 5000 || f.y < 0 || f.y > 5000) return `fields[${i}].x/y out of range`;
    if (f.font_size !== undefined && f.font_size !== null) {
      if (!isFiniteNumber(f.font_size) || f.font_size < 6 || f.font_size > 72) {
        return `fields[${i}].font_size must be 6-72`;
      }
    }
    if (f.fontSize !== undefined && f.fontSize !== null) {
      if (!isFiniteNumber(f.fontSize) || f.fontSize < 6 || f.fontSize > 72) {
        return `fields[${i}].fontSize must be 6-72`;
      }
    }
    if (f.date_format !== undefined && f.date_format !== null && f.date_format !== '') {
      if (typeof f.date_format !== 'string' || f.date_format.length > 50) {
        return `fields[${i}].date_format must be a string up to 50 chars`;
      }
    }
    if (f.validation !== undefined && f.validation !== null && f.validation !== '') {
      if (!ALLOWED_VALIDATIONS.has(f.validation)) {
        return `fields[${i}].validation must be one of ${[...ALLOWED_VALIDATIONS].join(', ')}`;
      }
    }
    if (f.page_number !== undefined && f.page_number !== null) {
      if (!Number.isInteger(f.page_number) || f.page_number < 0 || f.page_number > 5000) {
        return `fields[${i}].page_number must be an integer 0-5000`;
      }
    }
    if (f.id !== undefined && f.id !== null && f.id !== '') {
      if (typeof f.id !== 'string' || f.id.trim().length === 0 || f.id.length > 128) {
        return `fields[${i}].id must be a string 1-128 chars`;
      }
    }
  }
  return null;
}

export function validateDocumentUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Invalid request body';
  }
  const allowed = new Set(['title', 'slug', 'collect_email', 'status', 'settings']);
  const keys = Object.keys(body);
  if (keys.length === 0) return 'No fields to update';
  for (const k of keys) {
    if (!allowed.has(k)) {
      return `Field "${k}" is not allowed`;
    }
  }
  if ('title' in body) {
    if (!isNonEmptyString(body.title, { min: 1, max: 200 })) {
      return 'title must be 1-200 characters';
    }
  }
  if ('slug' in body) {
    if (typeof body.slug !== 'string' || body.slug.length === 0 || body.slug.length > 80 || !SLUG_RE.test(body.slug)) {
      return 'slug must be 1-80 chars, lowercase alphanumeric and hyphens';
    }
  }
  if ('collect_email' in body) {
    if (typeof body.collect_email !== 'boolean' && body.collect_email !== 0 && body.collect_email !== 1) {
      return 'collect_email must be a boolean';
    }
  }
  if ('status' in body) {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return `status must be one of ${[...ALLOWED_STATUSES].join(', ')}`;
    }
  }
  if ('settings' in body) {
    if (body.settings !== null && typeof body.settings !== 'object') {
      return 'settings must be an object';
    }
    // limit serialized size to 10k
    try {
      if (JSON.stringify(body.settings).length > 10_000) return 'settings too large';
    } catch {
      return 'settings must be serializable';
    }
  }
  return null;
}

export function validatePermissionRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid request body';
  const { email, permission } = body;
  if (!isEmail(email)) return 'email must be a valid email address';
  if (!ALLOWED_PERMISSIONS.has(permission)) return `permission must be one of ${[...ALLOWED_PERMISSIONS].join(', ')}`;
  return null;
}

export function validateAdminUserUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid request body';
  const { email, role, password, name } = body;
  if (email !== undefined) {
    if (!isEmail(email)) return 'email must be a valid email address';
  }
  if (role !== undefined) {
    if (!ALLOWED_ROLES.has(role)) return `role must be one of ${[...ALLOWED_ROLES].join(', ')}`;
  }
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return 'password must be 8-128 characters';
    }
  }
  if (name !== undefined) {
    if (name !== null && (typeof name !== 'string' || name.length > 100)) {
      return 'name must be a string up to 100 chars';
    }
  }
  return null;
}

export function validateSignatureUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid request body';
  const { fieldValues, field_values } = body;
  const fv = fieldValues !== undefined ? fieldValues : field_values;
  if (fv === undefined) return 'fieldValues is required';
  if (!fv || typeof fv !== 'object' || Array.isArray(fv)) return 'fieldValues must be an object';
  const keys = Object.keys(fv);
  if (keys.length > 200) return 'Too many fields';
  for (const k of keys) {
    const v = fv[k];
    if (typeof v !== 'string') return `Field ${k} must be a string`;
    if (v.length > 200_000) return `Field ${k} is too large`;
  }
  return null;
}

export function validateDocumentSettings(body) {
  if (body === null || body === undefined) return 'Invalid settings body';
  if (typeof body !== 'object' || Array.isArray(body)) return 'settings must be an object';
  try {
    if (JSON.stringify(body).length > 10_000) return 'settings too large';
  } catch {
    return 'settings must be serializable';
  }
  return null;
}
