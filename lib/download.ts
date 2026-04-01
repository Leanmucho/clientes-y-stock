import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function downloadFile(content: string, filename: string, mimeType: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const path = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const available = await Sharing.isAvailableAsync();
    if (!available) throw new Error('Compartir no está disponible en este dispositivo.');
    await Sharing.shareAsync(path, { mimeType, dialogTitle: `Guardar ${filename}` });
  }
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: any) => {
    const str = String(v ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}
