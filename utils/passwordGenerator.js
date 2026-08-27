/**
 * Centralized password generation utility for ShopDrop Controlled Onboarding.
 * Generates a predictable yet secure temporary password pattern for campus student and vendor onboarding.
 * Pattern: ShopDrop@<CURRENT_YEAR>#<INSTITUTION_CODE>
 */
const generateCommonTemporaryPassword = (institutionCode = 'CAMPUS') => {
  const currentYear = new Date().getFullYear();
  const cleanCode = String(institutionCode || 'CAMPUS')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  
  return `ShopDrop@${currentYear}#${cleanCode}`;
};

module.exports = {
  generateCommonTemporaryPassword,
};
