const { Client } = require("@notionhq/client");
require('dotenv').config();
const notion = new Client({ auth: process.env.NOTION_API_TOKEN });

async function createSummary() {
    console.log("Creating structured summary page...");

    const blocks = [
        // Hero callout
        {
            object: 'block',
            type: 'callout',
            callout: {
                rich_text: [{
                    type: 'text',
                    text: { content: 'Dossier d\'inscription Protectorat Saint Joseph - Année scolaire 2026-2027' }
                }],
                icon: { type: 'emoji', emoji: '🎓' },
                color: 'blue_background'
            }
        },

        // Section 1: Contrat de scolarisation
        {
            object: 'block',
            type: 'heading_1',
            heading_1: {
                rich_text: [{ type: 'text', text: { content: '📋 Contrat de Scolarisation' } }],
                color: 'blue'
            }
        },
        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: 'Frais d\'inscription' } }]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: 'Frais de dossier : ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: '50€ (acquis, non remboursable)' } }
                ]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: 'Acompte inscription : ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: '200€ (déduit de la contribution annuelle)' } }
                ]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: 'Réinscription : ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: '50€ (CB) + 150€ (prélèvement juin)' } }
                ]
            }
        },

        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: 'Engagements' } }]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [{ type: 'text', text: { content: 'Adhésion au Projet Éducatif et au Règlement Intérieur' } }]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [{ type: 'text', text: { content: 'Assiduité obligatoire' } }]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [{ type: 'text', text: { content: 'Assurance scolaire FIDES incluse' } }]
            }
        },

        {
            object: 'block',
            type: 'divider',
            divider: {}
        },

        // Section 2: Règlement Intérieur
        {
            object: 'block',
            type: 'heading_1',
            heading_1: {
                rich_text: [{ type: 'text', text: { content: '📖 Règlement Intérieur' } }],
                color: 'purple'
            }
        },
        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: 'Horaires' } }]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: 'Lundi au Vendredi : ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: '8h10 - 17h00' } }
                ]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [{ type: 'text', text: { content: 'Accueil dès 7h30 (garderie)' } }]
            }
        },

        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: 'Tenue professionnelle' } }]
            }
        },
        {
            object: 'block',
            type: 'callout',
            callout: {
                rich_text: [{
                    type: 'text',
                    text: { content: 'Obligatoire certains jours : Costume/cravate (garçons), Tailleur (filles)' }
                }],
                icon: { type: 'emoji', emoji: '👔' },
                color: 'gray_background'
            }
        },

        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: 'Règles importantes' } }]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: '📵 Portables interdits' }, annotations: { bold: true } },
                    { type: 'text', text: { content: ' dans les locaux' } }
                ]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: '⚠️ Sanctions dès 5 demi-journées' }, annotations: { bold: true } },
                    { type: 'text', text: { content: ' d\'absence injustifiée' } }
                ]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [{ type: 'text', text: { content: 'Respect strict du règlement intérieur' } }]
            }
        },

        {
            object: 'block',
            type: 'divider',
            divider: {}
        },

        // Section 3: Tarifs
        {
            object: 'block',
            type: 'heading_1',
            heading_1: {
                rich_text: [{ type: 'text', text: { content: '💰 Tarifs 2026-2027' } }],
                color: 'green'
            }
        },
        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: 'Contribution annuelle' } }]
            }
        },
        {
            object: 'block',
            type: 'table',
            table: {
                table_width: 2,
                has_column_header: true,
                has_row_header: false,
                children: [
                    {
                        object: 'block',
                        type: 'table_row',
                        table_row: {
                            cells: [
                                [{ type: 'text', text: { content: 'Poste' }, annotations: { bold: true } }],
                                [{ type: 'text', text: { content: 'Montant' }, annotations: { bold: true } }]
                            ]
                        }
                    },
                    {
                        object: 'block',
                        type: 'table_row',
                        table_row: {
                            cells: [
                                [{ type: 'text', text: { content: 'Scolarité (Collège/Lycée)' } }],
                                [{ type: 'text', text: { content: '1 585 € / an' } }]
                            ]
                        }
                    },
                    {
                        object: 'block',
                        type: 'table_row',
                        table_row: {
                            cells: [
                                [{ type: 'text', text: { content: 'Demi-pension (4 jours)' } }],
                                [{ type: 'text', text: { content: '850 € - 1 111 € / an' } }]
                            ]
                        }
                    },
                    {
                        object: 'block',
                        type: 'table_row',
                        table_row: {
                            cells: [
                                [{ type: 'text', text: { content: 'Cotisation APEL' } }],
                                [{ type: 'text', text: { content: '40,05 € / an' } }]
                            ]
                        }
                    }
                ]
            }
        },

        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: 'Modalités de paiement' } }]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: 'Prélèvement automatique : ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: '8 fois (octobre à mai, le 5 du mois)' } }
                ]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: 'Carte Bancaire : ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: 'via Ecole Directe' } }
                ]
            }
        },

        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: 'Réductions possibles' } }]
            }
        },
        {
            object: 'block',
            type: 'callout',
            callout: {
                rich_text: [{
                    type: 'text',
                    text: { content: 'Maximum 30% de réduction (non cumulables)' }
                }],
                icon: { type: 'emoji', emoji: '💡' },
                color: 'yellow_background'
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: '-30% ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: 'pour le 3ème enfant' } }
                ]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    { type: 'text', text: { content: '-25% ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: 'si parent salarié de l\'Enseignement Catholique' } }
                ]
            }
        },

        {
            object: 'block',
            type: 'divider',
            divider: {}
        },

        // Footer
        {
            object: 'block',
            type: 'callout',
            callout: {
                rich_text: [{
                    type: 'text',
                    text: { content: '✅ Tout mois commencé est dû intégralement en cas de désistement' },
                    annotations: { italic: true }
                }],
                icon: { type: 'emoji', emoji: '⚠️' },
                color: 'red_background'
            }
        }
    ];

    try {
        // Search for Protectorat page
        console.log("Searching for 'Protectorat' page...");
        const search = await notion.search({
            query: 'Protectorat',
            filter: { property: 'object', value: 'page' }
        });

        let parentId;
        if (search.results && search.results.length > 0) {
            parentId = search.results[0].id;
            console.log(`Found Protectorat page: ${parentId}`);
        } else {
            // Fallback to Projet Pochette cadeau
            parentId = '308f1980-ec18-806f-b932-eac77fe98838';
            console.log("Protectorat not found, using Projet Pochette cadeau as parent");
        }

        const newPage = await notion.pages.create({
            parent: { page_id: parentId },
            properties: {
                title: [
                    { text: { content: 'Protectorat Alyssa - Résumé' } }
                ]
            },
            icon: { type: 'emoji', emoji: '📚' },
            children: blocks
        });

        console.log(`✅ Page created successfully!`);
        console.log(`📍 URL: ${newPage.url}`);
        console.log(`🆔 ID: ${newPage.id}`);

    } catch (error) {
        console.error('❌ Error:', error.body || error.message);
    }
}

createSummary();
