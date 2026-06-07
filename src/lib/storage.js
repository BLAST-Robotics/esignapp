import { getEngine } from './drivers/engine.js';

const engine = getEngine();
const mod = await import(`./drivers/${engine}.js`);

export const initTable = mod.initTable;
export const createDocument = mod.createDocument;
export const getDocuments = mod.getDocuments;
export const getDocument = mod.getDocument;
export const getDocumentBySlug = mod.getDocumentBySlug;
export const getDocumentFile = mod.getDocumentFile;
export const updateDocument = mod.updateDocument;
export const deleteDocument = mod.deleteDocument;
export const saveDocumentFields = mod.saveDocumentFields;
export const getDocumentSettings = mod.getDocumentSettings;
export const updateDocumentSettings = mod.updateDocumentSettings;
export const insertSignature = mod.insertSignature;
export const getSignatures = mod.getSignatures;
export const getSignature = mod.getSignature;
export const updateSignature = mod.updateSignature;
export const deleteSignature = mod.deleteSignature;
