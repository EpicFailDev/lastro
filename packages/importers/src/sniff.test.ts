import { describe, it, expect } from 'vitest';
import { sniffDelimiter, detectDecimalSeparator } from './sniff';

describe('sniffDelimiter', () => {
  it('detecta vírgula', () => {
    expect(sniffDelimiter('Data,Valor,Descrição\n02/06/2026,15.00,Pix\n')).toBe(',');
  });
  it('detecta ponto-e-vírgula', () => {
    expect(sniffDelimiter('Data;Valor;Descrição\n02/06/2026;15,00;Pix\n')).toBe(';');
  });
  it('detecta tab', () => {
    expect(sniffDelimiter('Data\tValor\tDescrição\n02/06/2026\t15.00\tPix\n')).toBe('\t');
  });
});

describe('detectDecimalSeparator', () => {
  it('detecta ponto', () => {
    expect(detectDecimalSeparator(['15.00', '1000.50'])).toBe('.');
  });
  it('detecta vírgula', () => {
    expect(detectDecimalSeparator(['15,00', '1.000,50'])).toBe(',');
  });
});
