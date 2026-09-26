/**
 * MobileDrawer — admin sidebar as a slide-in sheet on < lg screens.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import AdminSidebar from './admin-sidebar';

export default function MobileDrawer({ open, onClose }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
      <div className="absolute inset-0 animate-fade-in bg-ink/50" onClick={onClose} aria-hidden="true" />
      <aside className="absolute inset-y-2.5 left-2.5 w-[min(280px,calc(100vw-20px))] animate-slide-up rounded-r28 bg-ink p-3 shadow-pop">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-3.5 z-10 grid h-9 w-9 place-items-center rounded-full text-on-dark hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
        <AdminSidebar collapsed={false} onNavClick={onClose} />
      </aside>
    </div>
  );
}
