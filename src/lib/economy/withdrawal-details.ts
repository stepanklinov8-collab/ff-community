import {z} from 'zod';

export const fullNameLatinSchema=z.string().trim().min(3,'Укажите полное ФИО латиницей').max(160,'Не более 160 символов')
 .regex(/^[A-Za-z][A-Za-z .'-]*[A-Za-z]$/,'Используйте латинские буквы, пробелы, дефис или апостроф');
export const transferCountrySchema=z.string().trim().min(2,'Укажите страну перевода').max(80,'Не более 80 символов')
 .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u,'Укажите название страны буквами');
export const withdrawalDetailsSchema=z.object({fullNameLatin:fullNameLatinSchema,transferCountry:transferCountrySchema}).strict();
