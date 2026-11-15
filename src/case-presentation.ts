/** Display rounding never alters the server's integer ticket weights. */
export const caseOdds=(weight:number)=>weight>0&&weight<100?'＜0.01%':new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(weight/10000)+'%'
export const CASE_DESCRIPTIONS:Record<string,string>={
 'movement-studio':'Leave a signature on every square. A studio of trails, light and dimensional motion.',
 'capture-theatre':'Make the final move unforgettable. Dramatic finishes for pieces leaving the board.',
 'effects-encore':'The curtain rises once more: a premium selection of movement and capture performances.',
 'icon-bronze':'Your first calling card. Discover a new face for your place in the multiverse.',
 'skin-bronze':'Fresh colors, familiar pieces. An everyday collection from the hands of the artisans.',
 'outline-basic':'New silhouettes begin here. Give a single piece a different shape on the battlefield.',
 'icon-silver':'Carry your colors proudly. Refined emblems for players ready to be remembered.',
 'icon-gold':'A seat among the sovereigns. An elevated collection of commanding player emblems.',
 'skin-silver':'From sketchbook to chessboard: crafted finishes, with a rare chance at an entire matching court.',
 'skin-gold':'Treasures made to outlast their owners. Rich piece finishes and occasional complete heirloom Sets.',
 'frame-orbit':'A little gravity for your identity. Animated frames that set your player icon in motion.',
 'frame-aureole':'Crown your calling card in light. Ornate, premium frames with a celestial flourish.',
 'shape-workshop':'Sculpted for a new perspective. Distinctive outlines, one piece at a time.',
 'shape-masterwork':'Architecture in miniature. Premium silhouettes with a chance at a complete matching outline Set.',
 'mixed-vault':'A small vault with many doors. Icons, finishes, outlines and more from across the collection.',
 'mixed-prismatic':'Every facet tells a different story. A premium mix of cosmetics and rare complete Sets.',
 'skin-collector':'For those building a court of their own. Single-piece discoveries with an increased chance of a full Set.',
 'mixed-relic':'Dust off something remarkable. A rare cabinet of premium cosmetics and complete collections.',
 'sets-regalia':'Dress the entire court. Every opening awards a complete skin Set, including its required outlines.',
 'sets-grandmaster':'The grand collection. Complete premium Sets for players with a taste for the exceptional.',
 'sets-silhouette':'Six pieces, one design language. Every opening brings a complete matching outline Set.',
 'monthly-solar':'From the sunlit observatory: warm metals, radiant motifs and seasonal discoveries.',
 'monthly-lunar':'Quiet wonders beneath a silver sky. Moonlit designs from the current seasonal collection.',
 'monthly-eclipse':'Where day meets night. Seasonal rarities and spectacular effects from the eclipse reliquary.'
}
