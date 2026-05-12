// ============================================
// User Guide - Interactive Documentation
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // --- Smooth Scroll Navigation ---
    const navItems = document.querySelectorAll('.guide-nav-item');
    const sections = document.querySelectorAll('.guide-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                // Update active state
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    // --- Scroll Spy (Update active nav on scroll) ---
    const guideContent = document.querySelector('.guide-content');
    
    guideContent.addEventListener('scroll', () => {
        let current = '';
        const scrollPos = guideContent.scrollTop + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (scrollPos >= sectionTop) {
                current = section.getAttribute('id');
            }
        });

        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === '#' + current) {
                item.classList.add('active');
            }
        });
    });

    // --- FAQ Accordion ---
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            // Close others
            faqItems.forEach(other => {
                if (other !== item) other.classList.remove('open');
            });
            // Toggle current
            item.classList.toggle('open');
        });
    });

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        // T - Toggle theme
        if (e.key === 't' || e.key === 'T') {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                toggleTheme();
            }
        }
        
        // H - Go home
        if (e.key === 'h' || e.key === 'H') {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                window.location.href = '../';
            }
        }
    });

    // --- Print Support ---
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-secondary';
    printBtn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:100;';
    printBtn.innerHTML = '🖨️ Print';
    printBtn.addEventListener('click', () => window.print());
    document.body.appendChild(printBtn);

    // --- Search Highlight (Simple) ---
    // Could be extended with a full search index
});