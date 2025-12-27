/**
 * Google Business Profile Resource Name Helpers
 * 
 * Centraliza funções para converter entre formatos de resource names
 * entre Business Information API v1 e My Business API v4
 */

/**
 * Extrai o ID numérico de um accountName
 * @param {string} accountNameOrId - "accounts/123" ou "123"
 * @returns {string} - "123"
 */
function extractAccountId(accountNameOrId) {
  if (!accountNameOrId) return '';
  // "accounts/123" -> "123" | "123" -> "123"
  return accountNameOrId.replace(/^accounts\//, '');
}

/**
 * Extrai o ID numérico de um locationName
 * @param {string} locationNameOrId - "locations/987" ou "accounts/123/locations/987" ou "987"
 * @returns {string} - "987"
 */
function extractLocationId(locationNameOrId) {
  if (!locationNameOrId) return '';
  // aceita:
  // "locations/987" -> "987"
  // "accounts/123/locations/987" -> "987"
  // "987" -> "987"
  return locationNameOrId
    .replace(/^accounts\/[^/]+\/locations\//, '')
    .replace(/^locations\//, '');
}

/**
 * Constrói o parent path para API v4 a partir de accountName e locationName
 * @param {string} accountNameOrId - "accounts/123" ou "123"
 * @param {string} locationNameOrId - "locations/987" ou "accounts/123/locations/987" ou "987"
 * @returns {string} - "accounts/123/locations/987"
 */
function buildV4Parent(accountNameOrId, locationNameOrId) {
  const accountId = extractAccountId(accountNameOrId);
  const locationId = extractLocationId(locationNameOrId);
  
  if (!accountId || !locationId) {
    throw new Error(`Invalid accountName or locationName: accountName=${accountNameOrId}, locationName=${locationNameOrId}`);
  }
  
  return `accounts/${accountId}/locations/${locationId}`;
}

/**
 * Normaliza accountName para garantir formato "accounts/123"
 * @param {string} accountNameOrId - "accounts/123" ou "123"
 * @returns {string} - "accounts/123"
 */
function normalizeAccountName(accountNameOrId) {
  if (!accountNameOrId) return '';
  if (accountNameOrId.startsWith('accounts/')) {
    return accountNameOrId;
  }
  return `accounts/${accountNameOrId}`;
}

/**
 * Normaliza locationName para garantir formato "locations/987"
 * @param {string} locationNameOrId - "locations/987" ou "accounts/123/locations/987" ou "987"
 * @returns {string} - "locations/987"
 */
function normalizeLocationName(locationNameOrId) {
  if (!locationNameOrId) return '';
  const locationId = extractLocationId(locationNameOrId);
  if (!locationId) return locationNameOrId;
  return `locations/${locationId}`;
}

module.exports = {
  extractAccountId,
  extractLocationId,
  buildV4Parent,
  normalizeAccountName,
  normalizeLocationName,
};

