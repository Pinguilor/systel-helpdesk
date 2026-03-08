import { LoginForm } from './LoginForm'
import Image from 'next/image' // ¡Añadimos la importación de Image!

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-cover bg-center flex items-center justify-center p-4 relative overflow-hidden" style={{ backgroundImage: "url('/login-bg-ai.png')" }}>
            {/* Subtle dark overlay for legibility of the background - lightened to 30% */}
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm z-0"></div>

            <div className="relative z-10 w-full max-w-4xl bg-slate-50/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px] border border-white/40">

                {/* Left Side */}
                {/* Panel alineado con el contenedor principal, sin fondo propio para transparencia uniforme */}
                <div className="md:w-1/2 p-10 flex flex-col relative min-h-[500px]">
                    {/* Capa de luz sutil para dar elegancia */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-30 pointer-events-none"></div>

                    {/* RECUADRO 1: Logo (Centrado perfectamente) */}
                    <div className="flex-1 flex items-center justify-center relative z-10 w-full">
                        <div className="hover:scale-110 transition-transform duration-500">
                            <Image
                                src="/looplogo-login.png"
                                alt="Logo Loop Login"
                                width={450}
                                height={150}
                                className="w-auto h-44 object-contain drop-shadow-md"
                                priority
                            />
                        </div>
                    </div>

                    {/* RECUADRO 2: Bienvenido (Abajo a la izquierda) */}
                    <div className="relative z-10 mt-auto">
                        <h1 className="text-sm font-semibold text-slate-500 tracking-wide uppercase opacity-70">
                            Bienvenido
                        </h1>
                    </div>
                </div>

                {/* Right Side (Client component for Error State and Form) */}
                <LoginForm />
            </div>

            <div className="absolute bottom-4 text-xs text-white/50 font-medium z-10 w-full text-center">
                &copy; {new Date().getFullYear()} Mesa de Ayuda Corporativa.
            </div>
        </div>
    )
}