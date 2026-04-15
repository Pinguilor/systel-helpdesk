'use client';

import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, CheckCircle2, UploadCloud, File as FileIcon, XCircle, PackageCheck, AlertTriangle } from 'lucide-react';
import { smartCloseAction } from '../actions';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';

interface SmartCloseModalProps {
    ticketId: string;
    onClose: () => void;
    packingList: any[];
}

export function SmartCloseModal({ ticketId, onClose, packingList }: SmartCloseModalProps) {
    const router = useRouter();
    const sigCanvas = useRef<SignatureCanvas>(null);
    
    // Core fields
    const [notas, setNotas] = useState('');
    const [nombreRecepcionista, setNombreRecepcionista] = useState('');
    const [adjuntos, setAdjuntos] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Reverse Logistics State
    // Para cada item en packingList, el usuario puede marcar si lo instaló o no
    const [instalados, setInstalados] = useState<Record<string, boolean>>({});
    // Para cada item instalado (que tenga true), puede registrar un número de serie retirado
    const [retirados, setRetirados] = useState<Record<string, string>>({});

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClearSignature = () => {
        sigCanvas.current?.clear();
    };

    const handleToggleInstalado = (movId: string, value: boolean) => {
        setInstalados(prev => ({ ...prev, [movId]: value }));
        if (!value) {
            // Eliminar su retirado si se desmarca
            setRetirados(prev => {
                const next = { ...prev };
                delete next[movId];
                return next;
            });
        }
    };

    const handleSerialRetiradoChange = (movId: string, serie: string) => {
        setRetirados(prev => ({ ...prev, [movId]: serie }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (sigCanvas.current?.isEmpty()) {
            return alert('La firma digital del recepcionista es obligatoria.');
        }

        setIsSubmitting(true);

        // GPS best-effort: 5s timeout, nunca bloquea el flujo
        let gpsLat: number | null = null;
        let gpsLng: number | null = null;
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) { reject(new Error('no-geo')); return; }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0,
                });
            });
            gpsLat = pos.coords.latitude;
            gpsLng = pos.coords.longitude;
        } catch {
            // Sin GPS: el cierre continúa con coordenadas nulas
        }

        const firmaDataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || '';

        const materialInstaladoIds: string[] = [];
        const equiposDañados: { catalogo_id: string; numero_serie: string }[] = [];

        packingList.forEach(mov => {
            if (instalados[mov.id]) {
                materialInstaladoIds.push(mov.inventario_id);
                // Si registró serie devuelta:
                if (retirados[mov.id] && retirados[mov.id].trim() !== '') {
                    equiposDañados.push({
                        catalogo_id: mov.inventario.catalogo_id,
                        numero_serie: retirados[mov.id].trim().toUpperCase()
                    });
                }
            }
        });

        const formData = new FormData();
        formData.append('ticketId', ticketId);
        formData.append('notas', notas);
        formData.append('nombreRecepcionista', nombreRecepcionista);
        formData.append('firma', firmaDataUrl);
        formData.append('materialInstalado', JSON.stringify(materialInstaladoIds));
        formData.append('equiposDañados', JSON.stringify(equiposDañados));

        adjuntos.forEach(file => {
            formData.append('adjuntos', file);
        });

        if (gpsLat !== null) formData.append('latitud', gpsLat.toString());
        if (gpsLng !== null) formData.append('longitud', gpsLng.toString());

        const res = await smartCloseAction(formData);
        
        setIsSubmitting(false);

        if (res.error) {
            alert(res.error);
        } else {
            onClose();
            router.refresh();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm sm:items-start sm:py-10 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-auto">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-emerald-50 text-emerald-900">
                    <h3 className="text-xl font-black flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        Cierre Inteligente en Terreno
                    </h3>
                    <button onClick={onClose} disabled={isSubmitting} className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        
                        {/* LEFT COLUMN: UNIVERSAL DATA */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Notas de Resolución (Obligatorio)</label>
                                <textarea 
                                    required
                                    rows={4}
                                    value={notas}
                                    onChange={e => setNotas(e.target.value)}
                                    placeholder="Detalla exactamente qué trabajo se realizó en el local..."
                                    className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50 focus:bg-white transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Evidencia Fotográfica / Adjuntos</label>
                                
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer flex flex-col items-center justify-center text-center gap-2" onClick={() => fileInputRef.current?.click()}>
                                    <UploadCloud className="w-8 h-8 text-slate-400" />
                                    <span className="text-sm font-bold text-slate-600">toca para subir archivos</span>
                                    <span className="text-xs text-slate-400">PDF, JPG, PNG (Max 5MB)</span>
                                </div>
                                <input 
                                    type="file" 
                                    multiple 
                                    className="hidden" 
                                    ref={fileInputRef}
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={async (e) => {
                                        if (e.target.files) {
                                            const filesArray = Array.from(e.target.files);
                                            const processedFiles = await Promise.all(filesArray.map(async (file) => {
                                                if (file.type.startsWith('image/')) {
                                                    try {
                                                        return await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true });
                                                    } catch (error) {
                                                        console.error('Error compressing image', error);
                                                        return file;
                                                    }
                                                }
                                                return file;
                                            }));
                                            setAdjuntos(processedFiles);
                                        }
                                    }}
                                />

                                {adjuntos.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {adjuntos.map((f, i) => (
                                            <span key={i} className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-1 rounded-md border border-emerald-200 flex items-center gap-2">
                                                <FileIcon className="w-3 h-3" />
                                                <span className="truncate max-w-[120px]">{f.name}</span>
                                                <button type="button" onClick={() => setAdjuntos(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500 ml-1 font-bold">
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: REVERSE LOGISTICS & SIGNATURE */}
                        <div className="space-y-6">
                            
                            {packingList.length > 0 && (
                                <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4">
                                    <label className="flex items-center gap-2 text-xs font-black uppercase text-orange-600 mb-3 border-b border-orange-100 pb-2">
                                        <PackageCheck className="w-4 h-4" /> Logística Inversa y Equipamiento
                                    </label>
                                    
                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                        {packingList.map(mov => {
                                            const isChecked = instalados[mov.id] || false;
                                            return (
                                                <div key={mov.id} className={`p-3 rounded-xl border transition-all ${isChecked ? 'bg-white border-emerald-200 shadow-sm' : 'bg-white/50 border-orange-200/50'}`}>
                                                    <label className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer">
                                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                                            <div className="relative flex items-start pt-0.5">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isChecked}
                                                                    onChange={(e) => handleToggleInstalado(mov.id, e.target.checked)}
                                                                    className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className={`text-sm font-bold truncate ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>
                                                                    {mov.inventario?.catalogo_equipos?.modelo}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                                                    Mover a Local
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="bg-slate-100 text-slate-700 font-black px-2 py-1 rounded text-xs self-start sm:self-auto shrink-0">
                                                            x{mov.cantidad}
                                                        </span>
                                                    </label>

                                                    {isChecked && (
                                                        <div className="mt-4 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                                            <label className="flex items-center gap-1.5 text-[10px] uppercase font-black text-slate-400 mb-2">
                                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                                ¿Retiró equipo dañado a cambio?
                                                            </label>
                                                            <input 
                                                                type="text"
                                                                placeholder="Ingrese N° Serie retirado (Opcional)"
                                                                value={retirados[mov.id] || ''}
                                                                onChange={e => handleSerialRetiradoChange(mov.id, e.target.value)}
                                                                className="w-full text-sm font-bold p-2.5 border border-amber-200 bg-amber-50/30 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-amber-300 placeholder:font-medium"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                                <label className="block text-xs font-black uppercase text-slate-500 mb-3">Conformidad del Cliente</label>
                                
                                <input 
                                    type="text" 
                                    required
                                    value={nombreRecepcionista}
                                    onChange={e => setNombreRecepcionista(e.target.value)}
                                    placeholder="Nombre de quien recibe conforme..."
                                    className="w-full text-sm font-bold p-3 border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />

                                <div className="border border-slate-300 bg-white rounded-xl overflow-hidden shadow-inner relative">
                                    <SignatureCanvas 
                                        ref={sigCanvas}
                                        penColor="black"
                                        canvasProps={{ className: 'w-full h-32 cursor-crosshair' }} 
                                    />
                                    <div className="absolute bottom-2 left-2 text-[10px] text-slate-400 font-bold pointer-events-none uppercase tracking-widest">
                                        Firma aquí
                                    </div>
                                    <button type="button" onClick={handleClearSignature} className="absolute top-2 right-2 text-[10px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors">
                                        Limpiar
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSubmitting || !notas || !nombreRecepcionista} className="px-8 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2">
                            {isSubmitting ? 'Procesando Cierre...' : 'CERRAR Y ENVIAR'}
                            {!isSubmitting && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
