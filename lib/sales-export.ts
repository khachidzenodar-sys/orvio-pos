import type {MenuClass, MenuEngineering, SalesAnalytics, SalesRow} from './sales-analytics';
import type {Sheet} from './xlsx';

// [icon, group name, what to do about it]
export const MENU_CLASS_TEXT: Record<MenuClass, [string, string, string]> = {
    star: ['⭐', 'ვარსკვლავები', 'ბევრი იყიდება და კარგი მოგება აქვს — შეინარჩუნეთ'],
    plowhorse: ['🐴', 'სამუშაო ცხენები', 'ბევრი იყიდება, მაგრამ მოგება დაბალია — გადახედეთ ფასს ან რეცეპტს'],
    puzzle: ['🧩', 'გამოცანები', 'კარგი მოგება აქვს, მაგრამ ცოტა იყიდება — უკეთ გამოაჩინეთ'],
    dog: ['🐕', 'სუსტები', 'ცოტა იყიდება და მოგებაც დაბალია — მენიუდან ამოღების კანდიდატი'],
    unknown: ['?', 'რეცეპტის გარეშე', 'მოგება ვერ დაითვლება — დაამატეთ რეცეპტი'],
};

const lari = (tetri: number | null) => tetri === null ? null : Math.round(tetri) / 100;
const head = ['დასახელება', 'გაყიდული (ც.)', 'გაყიდვები (₾)', 'თვითღირებულება (₾)', 'მოგება (₾)', 'მარჟა (%)', 'რეცეპტის გარეშე (₾)'];
const line = (r: SalesRow) => [r.name, r.quantity, lari(r.revenue), lari(r.cost), lari(r.profit), r.marginPercent, lari(r.uncosted)];

/** The sales analysis as three sheets: summary, departments, dishes (with their menu-engineering group). */
export function salesWorkbook(data: SalesAnalytics, menu: MenuEngineering, period: string): Sheet[] {
    const t = data.total;
    return [
        {name: 'შეჯამება', widths: [28, 18], rows: [['მაჩვენებელი', 'მნიშვნელობა'], ['პერიოდი', period], ['გაყიდვები (₾)', lari(t.revenue)], ['თვითღირებულება (₾)', lari(t.cost)], ['მოგება (₾)', lari(t.profit)], ['საშუალო მარჟა (%)', t.marginPercent], ['რეცეპტის გარეშე გაყიდვები (₾)', lari(t.uncosted)]]},
        {name: 'განყოფილებები', widths: [24, 14, 16, 20, 14, 12, 22], rows: [head, ...data.departments.map(line)]},
        {name: 'კერძები', widths: [28, 22, 14, 16, 22, 20, 18, 14, 12], rows: [
            ['კერძი', 'ჯგუფი', 'გაყიდული (ც.)', 'გაყიდვები (₾)', 'ერთეულის თვითღირებულება (₾)', 'თვითღირებულება (₾)', 'ერთეულის მოგება (₾)', 'მოგება (₾)', 'მარჟა (%)'],
            ...menu.rows.map(r => [r.name, MENU_CLASS_TEXT[r.group][1], r.quantity, lari(r.revenue), r.cost === null || !r.quantity ? null : lari(Math.round(r.cost / r.quantity)), lari(r.cost), r.unitProfit === null ? null : lari(Math.round(r.unitProfit)), lari(r.profit), r.marginPercent]),
        ]},
    ];
}
