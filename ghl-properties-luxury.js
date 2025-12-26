<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet">


<script>
/* ==========================================================================
   LUXURY REAL ESTATE - PROPERTIES MODULE LOGIC
   v31.1
   - Cards en Properties usando properties.property_floorplan_url
   - Funciona en All / Inventory / Smart Lists
   - Fix scroll + responsive
   - Atajos para editar relación Property en Contacts
   - Mejora visual/UX de relation-cards dentro del drawer de Properties
   ========================================================================== */

(function() {
    'use strict';

    const CONFIG = {
        wrapperSelector: '.h3BreqRip5vgBRyV1wRf',
        tableSelector: '.tabulator-table',
        rowSelector: '.tabulator-row',
        cardGridClass: 'properties-grid',
        activeClass: 'properties-module-active',
        debounceTime: 200,
        imageUrlField: 'properties.property_floorplan_url'
    };

    const State = {
        lastUrl: window.location.href,
        buildTimer: null,
        isBuilding: false,
        mainObserver: null,
        tableObserver: null,
        currentTable: null,
        debuggedOnce: false
    };

    /* ======================================================================
       DETECTORES DE MÓDULO
       ====================================================================== */

    function isPropertiesModule() {
        const url = window.location.href || '';
        return url.includes('/properties');
    }

    function isContactsModule() {
        const url = window.location.href || '';
        return url.includes('/contacts');
    }

    /* ======================================================================
       UTILIDADES TABULATOR (PROPERTIES)
       ====================================================================== */

    function getCellByField(row, fieldName) {
        let cell = row.querySelector(`.tabulator-cell[tabulator-field="${fieldName}"]`);
        if (!cell) {
            const cells = Array.from(row.querySelectorAll('.tabulator-cell'));
            cell = cells.find(c => {
                const f = (c.getAttribute('tabulator-field') || '').toLowerCase();
                return f.includes(fieldName.toLowerCase());
            });
        }
        return cell || null;
    }

    function getCellText(row, fieldName) {
        const cell = getCellByField(row, fieldName);
        return cell ? cell.textContent.trim() : '';
    }

    /* ======================================================================
       EXTRACCIÓN DE DATOS DE FILA (PROPERTIES)
       ====================================================================== */

    function extractRowData(row, isFirstRow) {
        let imagen = null;
        const allCells = Array.from(row.querySelectorAll('.tabulator-cell'));

        if (isFirstRow && !State.debuggedOnce) {
            console.group('🔍 DEBUG: Primera fila de Properties');
            allCells.forEach((c, i) => {
                const field = c.getAttribute('tabulator-field');
                console.log(`[${i}] field=`, field, 'text=', c.textContent.trim());
            });
            console.groupEnd();
            State.debuggedOnce = true;
        }

        // 1) Intentar usar directamente el campo properties.property_floorplan_url
        const imageUrlCell = getCellByField(row, CONFIG.imageUrlField);
        if (imageUrlCell) {
            const raw = imageUrlCell.textContent.trim();
            if (raw && /^https?:\/\//i.test(raw)) {
                imagen = raw;
            }
        }

        // 2) Fallback: buscar cualquier URL de imagen en las celdas
        if (!imagen) {
            for (const cell of allCells) {
                const html = cell.innerHTML || '';
                const match = html.match(/https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp|svg)/i);
                if (match) {
                    const url = match[0];
                    if (!url.includes('avatar') && !url.includes('icon')) {
                        imagen = url;
                        break;
                    }
                }
            }
        }

        return {
            nombre: getCellText(row, 'property') || row.querySelector('.tabulator-cell:first-child')?.textContent.trim(),
            owner: getCellText(row, 'owner'),
            project: getCellText(row, 'project') || getCellText(row, 'real'),
            bathrooms: getCellText(row, 'bathroom'),
            bedrooms: getCellText(row, 'bedroom'),
            precio: getCellText(row, 'price') || getCellText(row, 'asking'),
            status: getCellText(row, 'property_status'),
            buildingArea: getCellText(row, 'building') || getCellText(row, 'area'),
            imagen: imagen
        };
    }

    /* ======================================================================
       MANEJO DEL BOTÓN EDIT EN CARDS
       ====================================================================== */

    function handleEditClick(e, originalRow) {
        e.preventDefault();
        e.stopPropagation();

        const editBtn = originalRow.querySelector('span.primary-field-icon, .primary-field-icon');
        const tableElement = originalRow.closest('.tabulator-table');
        const grid = document.querySelector('.' + CONFIG.cardGridClass);

        if (editBtn && tableElement) {
            if (grid) grid.style.opacity = '0';

            const prevDisplay = tableElement.style.display;
            const prevVis = tableElement.style.visibility;
            const prevPos = tableElement.style.position;

            tableElement.style.display = 'block';
            tableElement.style.visibility = 'visible';
            tableElement.style.opacity = '0';
            tableElement.style.position = 'fixed';
            tableElement.style.top = '0';
            tableElement.style.left = '0';
            tableElement.style.zIndex = '-9999';

            requestAnimationFrame(() => {
                try {
                    editBtn.click();
                } catch (err) {
                    console.error('Error edit click:', err);
                }
                setTimeout(() => {
                    tableElement.style.display = 'none';
                    tableElement.style.opacity = '';
                    tableElement.style.position = prevPos;
                    tableElement.style.visibility = prevVis;
                    if (grid) grid.style.opacity = '1';
                }, 100);
            });
        }
    }

    /* ======================================================================
       CREACIÓN DE CARDS (PROPERTIES)
       ====================================================================== */

    function createCard(row, index) {
        const data = extractRowData(row, index === 0);
        const card = document.createElement('div');
        card.className = 'property-card';

        card.innerHTML = `
            <div class="card-image">
                ${data.imagen
                    ? `<img src="${data.imagen}" alt="Floor Plan" loading="lazy">`
                    : `<div class="image-fallback"><i class="fas fa-building"></i><span>No Image</span></div>`
                }
            </div>
            <div class="card-content">
                ${data.nombre ? `<h3 class="card-title">${data.nombre}</h3>` : ''}
                ${data.precio ? `<div class="card-price">${data.precio}</div>` : ''}
                
                ${(data.bedrooms || data.bathrooms) ? `
                <div class="card-specs">
                    ${data.bedrooms ? `<span><i class="fas fa-bed"></i> ${data.bedrooms} BD</span>` : ''}
                    ${data.bathrooms ? `<span><i class="fas fa-bath"></i> ${data.bathrooms} BA</span>` : ''}
                </div>` : ''}
                
                ${data.project ? `<div class="card-project">${data.project}</div>` : ''}
                ${data.owner ? `<div class="card-owner"><i class="fas fa-user"></i> ${data.owner}</div>` : ''}
                ${data.buildingArea ? `<div class="card-area">${data.buildingArea}</div>` : ''}
                ${data.status ? `<div class="card-status-inline">${data.status.toUpperCase()}</div>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn-edit">Edit</button>
            </div>
        `;

        const btn = card.querySelector('.btn-edit');
        btn.onclick = (e) => handleEditClick(e, row);

        return card;
    }

    /* ======================================================================
       BUILD DEL GRID (PROPERTIES)
       ====================================================================== */

    function buildGrid() {
        if (!isPropertiesModule()) return;

        const wrapper = document.querySelector(CONFIG.wrapperSelector);
        if (!wrapper) return;

        const table = wrapper.querySelector(CONFIG.tableSelector);
        if (!table) return;

        if (table !== State.currentTable) {
            monitorTable(table);
        }

        const rows = Array.from(table.querySelectorAll(CONFIG.rowSelector));

        if (rows.length === 0) {
            wrapper.classList.remove(CONFIG.activeClass);
            const existingGrid = wrapper.querySelector('.' + CONFIG.cardGridClass);
            if (existingGrid) existingGrid.innerHTML = '';
            return;
        }

        State.isBuilding = true;

        let grid = wrapper.querySelector('.' + CONFIG.cardGridClass);
        if (!grid) {
            grid = document.createElement('div');
            grid.className = CONFIG.cardGridClass;
            if (table.parentNode) {
                table.parentNode.appendChild(grid);
            }
        }

        const fragment = document.createDocumentFragment();
        rows.forEach((row, index) => {
            fragment.appendChild(createCard(row, index));
        });

        grid.innerHTML = '';
        grid.appendChild(fragment);
        grid.style.display = 'grid';

        wrapper.classList.add(CONFIG.activeClass);
        table.style.display = 'none';

        State.isBuilding = false;
    }

    /* ======================================================================
       OBSERVADORES PARA PROPERTIES
       ====================================================================== */

    function monitorTable(tableElement) {
        if (State.tableObserver) State.tableObserver.disconnect();
        State.currentTable = tableElement;

        State.tableObserver = new MutationObserver((mutations) => {
            if (State.isBuilding) return;
            const hasChanges = mutations.some(m => m.type === 'childList');
            if (hasChanges) {
                if (State.buildTimer) clearTimeout(State.buildTimer);
                State.buildTimer = setTimeout(buildGrid, CONFIG.debounceTime);
            }
        });

        State.tableObserver.observe(tableElement, { childList: true });
    }

    function initMainObserver() {
        State.mainObserver = new MutationObserver(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== State.lastUrl) {
                State.lastUrl = currentUrl;
                State.debuggedOnce = false;
                State.currentTable = null;
            }

            if (isPropertiesModule()) {
                const table = document.querySelector(CONFIG.wrapperSelector + ' ' + CONFIG.tableSelector);
                if (table && table !== State.currentTable) {
                    monitorTable(table);
                    buildGrid();
                }
            }
        });

        State.mainObserver.observe(document.body, { childList: true, subtree: true });
    }

    function initPropertiesModule() {
        console.log('🚀 Properties Module v31.1 (cards + URL campo properties.property_floorplan_url)');
        initMainObserver();
        if (isPropertiesModule()) {
            setInterval(() => {
                if (isPropertiesModule() && !State.isBuilding) {
                    const wrapper = document.querySelector(CONFIG.wrapperSelector);
                    if (wrapper && !wrapper.classList.contains(CONFIG.activeClass)) {
                        const rows = document.querySelectorAll(CONFIG.rowSelector);
                        if (rows.length > 0) buildGrid();
                    }
                }
            }, 2000);

            setTimeout(buildGrid, 500);
        }
    }

    /* ======================================================================
       EXTRA 1: Atajos para editar relación de Property desde Contacts
       ====================================================================== */

    function enhanceContactPropertyRelations() {
        if (!isContactsModule()) return;

        const relationCards = document.querySelectorAll(
            '.obj-relation-card, div[class*="obj-relation-card"], div[class*="relation-card"], div.lpx-4.lpy-3.border.border-solid.border-gray-200.flex.flex-col.gap-2.rounded-xl.obj-relation-card'
        );

        if (!relationCards.length) return;

        relationCards.forEach(card => {
            if (card.dataset.oraEnhanced === '1') return;
            card.dataset.oraEnhanced = '1';

            const typeBadge = Array.from(card.querySelectorAll('div, span, p'))
                .find(el => (el.textContent || '').trim().toLowerCase() === 'property');

            if (!typeBadge) {
                return;
            }

            card.style.cursor = 'pointer';

            card.addEventListener('click', function (e) {
                const target = e.target;
                if (target.closest('.ora-edit-prop-relation-btn')) {
                    return;
                }
                const menuBtn = card.querySelector('button, svg, i, span[role="button"]');
                if (menuBtn) {
                    try {
                        menuBtn.click();
                    } catch (err) {
                        console.error('Error triggering relation menu click:', err);
                    }
                }
            }, false);

            if (!card.querySelector('.ora-edit-prop-relation-btn')) {
                const footer = document.createElement('div');
                footer.className = 'ora-edit-prop-relation-footer';
                footer.innerHTML = `
                    <button class="ora-edit-prop-relation-btn" type="button">
                        Edit property relation
                    </button>
                `;
                card.appendChild(footer);

                const btn = footer.querySelector('.ora-edit-prop-relation-btn');
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const menuBtn = card.querySelector('button, svg, i, span[role="button"]');
                    if (menuBtn) {
                        try {
                            menuBtn.click();
                        } catch (err) {
                            console.error('Error triggering relation menu click from footer button:', err);
                        }
                    }
                });
            }
        });
    }

    function initContactsEnhancer() {
        const contactsObserver = new MutationObserver(() => {
            if (isContactsModule()) {
                enhanceContactPropertyRelations();
            }
        });

        contactsObserver.observe(document.body, { childList: true, subtree: true });

        if (isContactsModule()) {
            setTimeout(enhanceContactPropertyRelations, 1000);
        }
    }

    /* ======================================================================
       EXTRA 2: Mejora visual de relation-cards en drawer de Properties
       ====================================================================== */

    function enhancePropertyDrawerRelations() {
        if (!isPropertiesModule()) return;

        const relationCards = document.querySelectorAll(
            '.obj-relation-card, div[class*="obj-relation-card"], div[class*="relation-card"], div.lpx-4.lpy-3.border.border-solid.border-gray-200.flex.flex-col.gap-2.rounded-xl.obj-relation-card'
        );

        relationCards.forEach(card => {
            if (card.dataset.oraPropDrawerEnhanced === '1') return;
            card.dataset.oraPropDrawerEnhanced = '1';

            card.classList.add('ora-prop-relation-card');
        });
    }

    function initPropertyDrawerEnhancer() {
        const observer = new MutationObserver(() => {
            if (isPropertiesModule()) {
                enhancePropertyDrawerRelations();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        if (isPropertiesModule()) {
            setTimeout(enhancePropertyDrawerRelations, 1200);
        }
    }

    /* ======================================================================
       INIT GLOBAL
       ====================================================================== */

    function init() {
        initPropertiesModule();
        initContactsEnhancer();
        initPropertyDrawerEnhancer();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
</script>