    // ========== 드래그 ==========
    function makeDraggable(panel, handle) {
        let dragging = false;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;
        const savedPos = GM_getValue('panelPos', null);
        if (savedPos && Number.isFinite(savedPos.left) && Number.isFinite(savedPos.top)) {
            const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
            const left = Math.min(Math.max(0, savedPos.left), maxLeft);
            const top = Math.min(Math.max(0, savedPos.top), maxTop);
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        }
        const onDown = (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'button' || tag === 'select') return;
            dragging = true;
            const evt = e.touches ? e.touches[0] : e;
            startX = evt.clientX;
            startY = evt.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.left = startLeft + 'px';
            panel.style.top = startTop + 'px';
            panel.style.right = 'auto';
            handle.style.cursor = 'grabbing';
            e.preventDefault();
        };
        const onMove = (e) => {
            if (!dragging) return;
            const evt = e.touches ? e.touches[0] : e;
            const dx = evt.clientX - startX;
            const dy = evt.clientY - startY;
            let newLeft = startLeft + dx;
            let newTop = startTop + dy;
            const maxLeft = window.innerWidth - panel.offsetWidth;
            const maxTop = window.innerHeight - panel.offsetHeight;
            newLeft = Math.min(Math.max(0, newLeft), Math.max(0, maxLeft));
            newTop = Math.min(Math.max(0, newTop), Math.max(0, maxTop));
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            handle.style.cursor = 'grab';
            const rect = panel.getBoundingClientRect();
            GM_setValue('panelPos', { left: rect.left, top: rect.top });
        };
        handle.addEventListener('mousedown', onDown);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        handle.addEventListener('touchstart', onDown, { passive: false });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }
