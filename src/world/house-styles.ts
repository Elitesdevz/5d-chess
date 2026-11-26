export const layouts=['Compact one-bedroom','Standard apartment','Family apartment'] as const
export const houseStyles=['Traditional cottage','Modern family house','Brick townhouse','Detached home'] as const
export const houseDesign=(i:number)=>Math.floor(i/2)%4
export const houseLevels=(i:number)=>houseDesign(i)===2?2:1
export const flatEdges=[-10.4,-4.55,1.9,10.4]
