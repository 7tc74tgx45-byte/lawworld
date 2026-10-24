// Curriculum generated from the Obsidian vault's note headings (T02).
// modules → regions (season) → districts (one per note) → subsections (one per heading).
// Only short extracted lists live here; the game reads note prose live at runtime.
import { foundationsDistricts } from './curriculum/foundations.js';
import { contractDistricts } from './curriculum/contract.js';
import { tortDistricts } from './curriculum/tort.js';
import { publicLawDistricts } from './curriculum/publicLaw.js';

export const curriculum = {
  version: 1,
  source: 'vault',
  modules: [
    {
      id: 'LAW7053', title: 'Legal Foundations', author: 'Rutherford',
      regions: [{ id: 'foundations', title: 'Foundations', season: 'spring', material: 'Ink', districts: foundationsDistricts }],
    },
    {
      id: 'LAW7054-contract', title: 'Contract Law', author: 'Poole; Merkin & Saintier',
      regions: [{ id: 'contract', title: 'Contract', season: 'summer', material: 'Precedent Scrolls', districts: contractDistricts }],
    },
    {
      id: 'LAW7054-tort', title: 'Tort Law', author: 'Brennan',
      regions: [{ id: 'tort', title: 'Tort', season: 'autumn', material: 'Case Reports', districts: tortDistricts }],
    },
    {
      id: 'LAW7055', title: 'Public Law', author: 'Stanton & Prescott; Bingham',
      regions: [{ id: 'public-law', title: 'Public Law', season: 'winter', material: 'Statute Rolls', districts: publicLawDistricts }],
    },
  ],
};

export default curriculum;
