/**
 * Compresión de imágenes en el navegador (estándar de la app):
 * máx. 1920px de ancho, JPEG calidad 0.75. Archivos < 300 KB se devuelven intactos.
 * Solo usar en componentes cliente.
 */
export async function compressImage(file: File, maxWidth = 1920, quality = 0.75): Promise<File> {
    if (file.size < 300 * 1024) return file; // ya es pequeño, no comprimir

    return new Promise(resolve => {
        const img = new Image();
        const objUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objUrl);
            const scale = img.width > maxWidth ? maxWidth / img.width : 1;
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                blob => {
                    if (!blob) { resolve(file); return; }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    }));
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
        img.src = objUrl;
    });
}
