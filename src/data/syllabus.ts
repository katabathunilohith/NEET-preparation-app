import type { Chapter, Subject } from '../types';

type Row = [id: string, unit: string, name: string, cls: 11 | 12, weight: number, keywords: string];

const PHYSICS: Row[] = [
  ['p-units', 'Mechanics', 'Units and Measurements', 11, 2, 'dimensions errors significant figures SI'],
  ['p-kinematics', 'Mechanics', 'Kinematics (Motion in a Line & Plane)', 11, 3, 'velocity acceleration projectile relative motion vectors'],
  ['p-laws', 'Mechanics', 'Laws of Motion', 11, 3, 'newton friction tension pulley inertia'],
  ['p-wep', 'Mechanics', 'Work, Energy and Power', 11, 2, 'kinetic potential collision power'],
  ['p-rot', 'Mechanics', 'System of Particles and Rotational Motion', 11, 3, 'torque moment of inertia rolling angular momentum centre of mass'],
  ['p-grav', 'Mechanics', 'Gravitation', 11, 2, 'kepler escape velocity satellite orbital'],
  ['p-solids', 'Properties of Matter & Thermodynamics', 'Mechanical Properties of Solids', 11, 1, 'stress strain young modulus elasticity'],
  ['p-fluids', 'Properties of Matter & Thermodynamics', 'Mechanical Properties of Fluids', 11, 2, 'bernoulli viscosity surface tension pressure stokes'],
  ['p-thermal', 'Properties of Matter & Thermodynamics', 'Thermal Properties of Matter', 11, 1, 'expansion calorimetry radiation conduction wien stefan'],
  ['p-thermo', 'Properties of Matter & Thermodynamics', 'Thermodynamics', 11, 2, 'carnot isothermal adiabatic first law heat engine'],
  ['p-ktg', 'Properties of Matter & Thermodynamics', 'Kinetic Theory of Gases', 11, 1, 'rms speed degrees of freedom ideal gas'],
  ['p-osc', 'Oscillations & Waves', 'Oscillations', 11, 2, 'shm pendulum spring amplitude'],
  ['p-waves', 'Oscillations & Waves', 'Waves', 11, 1, 'sound organ pipe string doppler beats'],
  ['p-charges', 'Electrostatics & Current', 'Electric Charges and Fields', 12, 2, 'coulomb gauss flux dipole field'],
  ['p-capacitance', 'Electrostatics & Current', 'Electrostatic Potential and Capacitance', 12, 2, 'capacitor dielectric potential energy equipotential'],
  ['p-current', 'Electrostatics & Current', 'Current Electricity', 12, 4, 'ohm resistance kirchhoff cell emf wheatstone drift'],
  ['p-magnetic', 'Magnetism & EMI', 'Moving Charges and Magnetism', 12, 3, 'lorentz biot savart ampere cyclotron galvanometer'],
  ['p-magmatter', 'Magnetism & EMI', 'Magnetism and Matter', 12, 1, 'diamagnetic paramagnetic ferromagnetic susceptibility'],
  ['p-emi', 'Magnetism & EMI', 'Electromagnetic Induction', 12, 2, 'faraday lenz inductance motional emf'],
  ['p-ac', 'Magnetism & EMI', 'Alternating Current', 12, 2, 'lcr resonance impedance rms transformer'],
  ['p-emw', 'Magnetism & EMI', 'Electromagnetic Waves', 12, 1, 'spectrum displacement current gamma'],
  ['p-ray', 'Optics', 'Ray Optics and Optical Instruments', 12, 3, 'lens mirror refraction prism critical angle microscope'],
  ['p-wave-optics', 'Optics', 'Wave Optics', 12, 2, 'interference ydse diffraction polarisation huygens'],
  ['p-dual', 'Modern Physics', 'Dual Nature of Radiation and Matter', 12, 2, 'photoelectric de broglie work function'],
  ['p-atoms', 'Modern Physics', 'Atoms', 12, 1, 'bohr model hydrogen spectrum'],
  ['p-nuclei', 'Modern Physics', 'Nuclei', 12, 1, 'radioactivity half life binding energy fission'],
  ['p-semi', 'Modern Physics', 'Semiconductor Electronics', 12, 3, 'diode logic gates pn junction transistor'],
];

const CHEMISTRY: Row[] = [
  ['c-basic', 'Physical Chemistry', 'Some Basic Concepts of Chemistry', 11, 2, 'mole molarity stoichiometry empirical formula'],
  ['c-atom', 'Physical Chemistry', 'Structure of Atom', 11, 2, 'quantum numbers bohr orbitals'],
  ['c-thermo', 'Physical Chemistry', 'Thermodynamics', 11, 2, 'enthalpy entropy gibbs spontaneity hess'],
  ['c-equil', 'Physical Chemistry', 'Equilibrium', 11, 3, 'ph kp kc buffer solubility product le chatelier'],
  ['c-redox', 'Physical Chemistry', 'Redox Reactions', 11, 1, 'oxidation number balancing'],
  ['c-solutions', 'Physical Chemistry', 'Solutions', 12, 2, 'colligative raoult vant hoff osmotic'],
  ['c-electro', 'Physical Chemistry', 'Electrochemistry', 12, 2, 'nernst faraday conductance cell potential'],
  ['c-kinetics', 'Physical Chemistry', 'Chemical Kinetics', 12, 2, 'rate order half life arrhenius'],
  ['c-periodic', 'Inorganic Chemistry', 'Classification of Elements and Periodicity', 11, 2, 'ionisation enthalpy electronegativity atomic radius'],
  ['c-bonding', 'Inorganic Chemistry', 'Chemical Bonding and Molecular Structure', 11, 4, 'vsepr hybridisation mot bond order dipole'],
  ['c-pblock', 'Inorganic Chemistry', 'p-Block Elements', 12, 3, 'group 15 16 17 18 oxoacids halogens noble gases'],
  ['c-dfblock', 'Inorganic Chemistry', 'd- and f-Block Elements', 12, 2, 'transition lanthanoid contraction magnetic moment'],
  ['c-coord', 'Inorganic Chemistry', 'Coordination Compounds', 12, 3, 'iupac isomerism cft ligand werner'],
  ['c-goc', 'Organic Chemistry', 'Organic Chemistry: Basic Principles', 11, 3, 'goc inductive resonance carbocation isomerism purification'],
  ['c-hydrocarbons', 'Organic Chemistry', 'Hydrocarbons', 11, 2, 'alkane alkene alkyne aromatic markovnikov ozonolysis'],
  ['c-haloalkanes', 'Organic Chemistry', 'Haloalkanes and Haloarenes', 12, 2, 'sn1 sn2 elimination'],
  ['c-alcohols', 'Organic Chemistry', 'Alcohols, Phenols and Ethers', 12, 2, 'lucas acidity reimer tiemann williamson'],
  ['c-carbonyl', 'Organic Chemistry', 'Aldehydes, Ketones and Carboxylic Acids', 12, 3, 'aldol cannizzaro iodoform nucleophilic addition'],
  ['c-amines', 'Organic Chemistry', 'Amines', 12, 2, 'basicity carbylamine hinsberg diazonium'],
  ['c-biomolecules', 'Organic Chemistry', 'Biomolecules', 12, 2, 'carbohydrates proteins vitamins nucleic acids'],
  ['c-practical', 'Organic Chemistry', 'Principles of Practical Chemistry', 12, 1, 'salt analysis lassaigne titration'],
];

const BIOLOGY: Row[] = [
  ['b-living', 'Diversity in Living World', 'The Living World', 11, 1, 'taxonomy binomial nomenclature hierarchy'],
  ['b-bioclass', 'Diversity in Living World', 'Biological Classification', 11, 3, 'five kingdom monera protista fungi virus viroid'],
  ['b-plantk', 'Diversity in Living World', 'Plant Kingdom', 11, 3, 'algae bryophytes pteridophytes gymnosperms alternation of generation'],
  ['b-animalk', 'Diversity in Living World', 'Animal Kingdom', 11, 4, 'phylum chordata coelom symmetry'],
  ['b-morph', 'Structural Organisation', 'Morphology of Flowering Plants', 11, 3, 'root stem leaf inflorescence floral formula families'],
  ['b-anatomy', 'Structural Organisation', 'Anatomy of Flowering Plants', 11, 2, 'tissues meristem vascular bundle secondary growth'],
  ['b-animal-tissue', 'Structural Organisation', 'Structural Organisation in Animals', 11, 2, 'epithelium connective muscle tissue frog cockroach'],
  ['b-cell', 'Cell Structure & Function', 'Cell: The Unit of Life', 11, 3, 'organelles prokaryotic eukaryotic membrane'],
  ['b-biomol', 'Cell Structure & Function', 'Biomolecules', 11, 3, 'enzymes proteins carbohydrates nucleotides'],
  ['b-cellcycle', 'Cell Structure & Function', 'Cell Cycle and Cell Division', 11, 2, 'mitosis meiosis prophase crossing over'],
  ['b-photo', 'Plant Physiology', 'Photosynthesis in Higher Plants', 11, 2, 'calvin c4 photosystem light reaction photorespiration'],
  ['b-resp', 'Plant Physiology', 'Respiration in Plants', 11, 2, 'glycolysis krebs ets atp rq'],
  ['b-growth', 'Plant Physiology', 'Plant Growth and Development', 11, 2, 'auxin gibberellin cytokinin aba ethylene'],
  ['b-breath', 'Human Physiology', 'Breathing and Exchange of Gases', 11, 2, 'lung volumes oxygen transport haemoglobin'],
  ['b-fluids', 'Human Physiology', 'Body Fluids and Circulation', 11, 2, 'heart blood groups cardiac cycle ecg'],
  ['b-excretion', 'Human Physiology', 'Excretory Products and their Elimination', 11, 2, 'nephron kidney counter current adh'],
  ['b-locomotion', 'Human Physiology', 'Locomotion and Movement', 11, 2, 'muscle contraction sarcomere skeleton joints'],
  ['b-neural', 'Human Physiology', 'Neural Control and Coordination', 11, 2, 'neuron synapse brain eye ear'],
  ['b-chemical', 'Human Physiology', 'Chemical Coordination and Integration', 11, 2, 'hormones endocrine pituitary thyroid'],
  ['b-plantrepro', 'Reproduction', 'Sexual Reproduction in Flowering Plants', 12, 3, 'pollination embryo sac double fertilisation'],
  ['b-humanrepro', 'Reproduction', 'Human Reproduction', 12, 3, 'gametogenesis menstrual cycle fertilisation pregnancy'],
  ['b-repro-health', 'Reproduction', 'Reproductive Health', 12, 2, 'contraception std infertility art'],
  ['b-inheritance', 'Genetics & Evolution', 'Principles of Inheritance and Variation', 12, 5, 'mendel linkage sex determination pedigree disorders'],
  ['b-molecular', 'Genetics & Evolution', 'Molecular Basis of Inheritance', 12, 5, 'dna replication transcription translation lac operon genetic code'],
  ['b-evolution', 'Genetics & Evolution', 'Evolution', 12, 2, 'darwin hardy weinberg origin of life'],
  ['b-health', 'Biology & Human Welfare', 'Human Health and Disease', 12, 3, 'immunity pathogens cancer drugs aids'],
  ['b-microbes', 'Biology & Human Welfare', 'Microbes in Human Welfare', 12, 2, 'fermentation antibiotics sewage biogas biocontrol'],
  ['b-biotech-principles', 'Biotechnology', 'Biotechnology: Principles and Processes', 12, 4, 'restriction enzyme vector pcr electrophoresis'],
  ['b-biotech-apps', 'Biotechnology', 'Biotechnology and its Applications', 12, 3, 'bt crops gene therapy transgenic rnai'],
  ['b-organisms', 'Ecology', 'Organisms and Populations', 12, 3, 'population growth interactions adaptation'],
  ['b-ecosystem', 'Ecology', 'Ecosystem', 12, 3, 'productivity decomposition pyramids energy flow'],
  ['b-biodiversity', 'Ecology', 'Biodiversity and Conservation', 12, 3, 'hotspots in situ ex situ extinction'],
];

function build(subject: Subject, rows: Row[]): Chapter[] {
  return rows.map(([id, unit, name, classLevel, weight, kw]) => ({
    id,
    subject,
    unit,
    name,
    classLevel,
    weight,
    keywords: kw.split(' '),
  }));
}

export const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Biology'];

/** Questions per subject in the real NEET paper (180 total, +4 / −1). */
export const NEET_PATTERN: Record<Subject, number> = { Physics: 45, Chemistry: 45, Biology: 90 };

export const CHAPTERS: Chapter[] = [
  ...build('Physics', PHYSICS),
  ...build('Chemistry', CHEMISTRY),
  ...build('Biology', BIOLOGY),
];

export const CHAPTER_BY_ID: Record<string, Chapter> = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

/** Share of the NEET paper's marks this chapter is expected to carry (sums to 1 across all chapters). */
export function chapterShare(ch: Chapter): number {
  const subjectChapters = CHAPTERS.filter((c) => c.subject === ch.subject);
  const total = subjectChapters.reduce((s, c) => s + c.weight, 0);
  return (ch.weight / total) * (NEET_PATTERN[ch.subject] / 180);
}

export function unitsOf(subject: Subject): string[] {
  return [...new Set(CHAPTERS.filter((c) => c.subject === subject).map((c) => c.unit))];
}
