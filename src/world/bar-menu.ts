export const BAR={x:-6.2,z:6.13}
export const BAR_COUNTER={x:-6.25,z:7.23}
export const BAR_STOOLS=[-8.5,-7.2,-5.9,-4.6].map(x=>({x,z:6.28,yaw:Math.PI}))
export const DRINKS=[
  {id:'lime',name:'House Lime Soda',price:8,note:'Fresh lime over soda and chipped ice',color:0xc4cb81},
  {id:'saffron',name:'Golden Hour',price:68,note:'Saffron, apricot and orange blossom',color:0xe2ab56},
  {id:'royal',name:'Royal Highball',price:38,note:'Ginger, citrus and a ribbon of orange',color:0xc28141},
  {id:'orchard',name:'Orchard Spritz',price:48,note:'Tart apple, thyme and sparkling water',color:0xaab570},
  {id:'midnight',name:'Midnight Fizz',price:58,note:'Blackberry, lemon and crushed ice',color:0x78465e},
] as const
export type BarService={drink:(typeof DRINKS)[number]['id'];name:string;starts:number;ready:number;id:string}
