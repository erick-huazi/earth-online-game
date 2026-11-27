// These passages and UTF-16 anchors refer to this repository's bundled editions.
// Keep the v1 bank and its row order stable for existing daily links and saves.
(() => {
  'use strict';
  const rows = [
    {"id":"daodejing-1","bookId":"daodejing","section":0,"title":"第一章","text":"道可道，非常道。名可名，非常名。","start":0,"prefix":"","suffix":"\n\n无名天地之始﹔有名万"},
    {"id":"daodejing-9","bookId":"daodejing","section":8,"title":"第九章","text":"功遂身退，天之道也。","start":48,"prefix":"富贵而骄，自遗其咎。\n\n","suffix":""},
    {"id":"daodejing-11","bookId":"daodejing","section":10,"title":"第十一章","text":"故有之以为利，无之以为用。","start":54,"prefix":"，当其无，有室之用。\n\n","suffix":""},
    {"id":"daodejing-12","bookId":"daodejing","section":11,"title":"第十二章","text":"是以圣人为腹不为目，故去彼取此。","start":46,"prefix":"难得之货，令人行妨。\n\n","suffix":""},
    {"id":"daodejing-25","bookId":"daodejing","section":24,"title":"第二十五章","text":"有物混成，先天地生。","start":0,"prefix":"","suffix":"\n\n寂兮寥兮，独立而不改"},
    {"id":"daodejing-33","bookId":"daodejing","section":32,"title":"第三十三章","text":"知人者智，自知者明。","start":0,"prefix":"","suffix":"\n\n胜人者有力，\n\n自胜"},
    {"id":"daodejing-41","bookId":"daodejing","section":40,"title":"第四十一章","text":"不笑不足以为道。","start":35,"prefix":"\n下士闻道，大笑之。\n\n","suffix":"\n\n故建言有之：\n\n明道"},
    {"id":"daodejing-44","bookId":"daodejing","section":43,"title":"第四十四章","text":"故知足不辱，知止不殆，可以长久。","start":34,"prefix":"必大费﹔多藏必厚亡。\n\n","suffix":""},
    {"id":"daodejing-45","bookId":"daodejing","section":44,"title":"第四十五章","text":"大成若缺，其用不弊。","start":0,"prefix":"","suffix":"\n\n大盈若冲，其用不穷。"},
    {"id":"daodejing-64","bookId":"daodejing","section":63,"title":"第六十四章","text":"慎终如始，则无败事。","start":90,"prefix":"事，常于几成而败之。\n\n","suffix":""},
    {"id":"daodejing-77","bookId":"daodejing","section":76,"title":"第七十七章","text":"天之道，损有余而补不足。","start":38,"prefix":"者损之，不足者补之。\n\n","suffix":"\n\n人之道，则不然，损不"},
    {"id":"daodejing-81","bookId":"daodejing","section":80,"title":"第八十一章","text":"信言不美，美言不信。","start":0,"prefix":"","suffix":"\n\n善者不辩，辩者不善。"},
    {"id":"yijing-1","bookId":"yijing","section":0,"title":"〈乾〉第一","text":"天行健，君子以自強不息。","start":202,"prefix":"萬國咸寧。\n\n《象》曰：","suffix":"「潛龍勿用」、陽在下也。","prompt":"天行健，君子以自强不息。"},
    {"id":"yijing-2","bookId":"yijing","section":1,"title":"〈坤〉第二","text":"地勢坤。君子以厚德載物。","start":180,"prefix":"應地无疆。\n\n《象》曰：","suffix":"\n\n初六：履霜、堅冰至。","prompt":"地势坤。君子以厚德载物。"},
    {"id":"yijing-4","bookId":"yijing","section":3,"title":"〈蒙〉第四","text":"匪我求童蒙，童蒙來求我。","start":12,"prefix":"䷃坎下艮上\n\n《蒙》亨。","suffix":"初筮告，再三瀆，瀆則不告","prompt":"匪我求童蒙，童蒙来求我。"},
    {"id":"yijing-14","bookId":"yijing","section":13,"title":"〈大有〉第十四","text":"君子以遏惡揚善，順天休命。","start":82,"prefix":"曰：火在天上，《大有》。","suffix":"\n\n初九：无交害，匪咎、","prompt":"君子以遏恶扬善，顺天休命。"},
    {"id":"yijing-15","bookId":"yijing","section":14,"title":"〈謙〉第十五","text":"天道虧盈而益謙，地道變盈而流謙，鬼神害盈而福謙，人道惡盈而好謙。","start":46,"prefix":"濟而光明，地道卑而上行。","suffix":"《謙》、尊而光，卑而不可","prompt":"天道亏盈而益谦，地道变盈而流谦，鬼神害盈而福谦，人道恶盈而好谦。"},
    {"id":"yijing-22","bookId":"yijing","section":21,"title":"〈賁〉第二十二","text":"觀乎天文以察時變，觀乎人文以化成天下。","start":77,"prefix":"文也。文明以止，人文也。","suffix":"\n\n《象》曰：山下有火，","prompt":"观乎天文以察时变，观乎人文以化成天下。"},
    {"id":"yijing-26","bookId":"yijing","section":25,"title":"〈大畜〉第二十六","text":"君子以多識前言往行以畜其德。","start":102,"prefix":"曰：天在山中，《大畜》。","suffix":"\n\n初九：有厲，利己。\n","prompt":"君子以多识前言往行以畜其德。"},
    {"id":"yijing-28","bookId":"yijing","section":27,"title":"〈大過〉第二十八","text":"君子以獨立不懼，遯世无悶。","start":96,"prefix":"》曰：澤滅木，《大過》。","suffix":"\n\n初六：藉用白茅，无咎","prompt":"君子以独立不惧，遯世无闷。"},
    {"id":"yijing-52","bookId":"yijing","section":51,"title":"〈艮〉第五十二","text":"君子以思不出其位。","start":118,"prefix":"《象》曰：兼山，《艮》。","suffix":"\n\n初六：艮其趾，无咎。"},
    {"id":"yijing-58","bookId":"yijing","section":57,"title":"〈兌〉第五十八","text":"君子以朋友講習。","start":95,"prefix":"《象》曰：麗澤，《兌》。","suffix":"\n\n初九：和兌，吉。\n\n","prompt":"君子以朋友讲习。"},
    {"id":"yijing-65","bookId":"yijing","section":64,"title":"〈繫辭上〉","text":"方以類聚，物以群分，吉凶生矣。","start":32,"prefix":"動靜有常，剛柔斷矣。\n\n","suffix":"在天成象，在地成形，變化","prompt":"方以类聚，物以群分，吉凶生矣。"},
    {"id":"yijing-66","bookId":"yijing","section":65,"title":"〈繫辭下〉","text":"天地之大德曰生，聖人之大寶曰位。","start":180,"prefix":"見乎變，聖人之情見乎辭。","suffix":"何以守位曰仁，何以聚人曰","prompt":"天地之大德曰生，圣人之大宝曰位。"},
    {"id":"zhuangzi-1","bookId":"zhuangzi","section":0,"title":"〈逍遙遊〉第一","text":"小知不及大知，小年不及大年。","start":364,"prefix":"聚糧。之二蟲又何知！\n\n","suffix":"奚以知其然也？朝菌不知晦"},
    {"id":"zhuangzi-2","bookId":"zhuangzi","section":1,"title":"〈齊物論〉第二","text":"天地與我並生，而萬物與我為一。","start":2047,"prefix":"乎殤子，而彭祖為夭。\n\n","suffix":"既已為一矣，且得有言乎？","prompt":"天地与我并生，而万物与我为一。"},
    {"id":"zhuangzi-3","bookId":"zhuangzi","section":2,"title":"〈養生主〉第三","text":"吾生也有涯，而知也无涯。","start":0,"prefix":"","suffix":"以有涯隨无涯，殆已；已而"},
    {"id":"zhuangzi-4","bookId":"zhuangzi","section":3,"title":"〈人間世〉第四","text":"來世不可待，往世不可追也。","start":3401,"prefix":"鳳兮鳳兮，何如德之衰也！","suffix":"天下有道，聖人成焉；天下","prompt":"来世不可待，往世不可追也。"},
    {"id":"zhuangzi-6","bookId":"zhuangzi","section":5,"title":"〈大宗師〉第六","text":"知天之所為，知人之所為者，至矣。","start":0,"prefix":"","suffix":"知天之所為者，天而生也；","prompt":"知天之所为，知人之所为者，至矣。"},
    {"id":"zhuangzi-13","bookId":"zhuangzi","section":12,"title":"〈天道〉第十三","text":"聖人之心靜乎！天地之鑒也，萬物之鏡也。","start":132,"prefix":"焉。水靜猶明，而況精神！","suffix":"\n\n夫虛靜恬淡寂漠无為者","prompt":"圣人之心静乎！天地之鉴也，万物之镜也。"},
    {"id":"zhuangzi-17","bookId":"zhuangzi","section":16,"title":"〈秋水〉第十七","text":"秋水時至，百川灌河，涇流之大，兩涘渚崖之間，不辯牛馬。","start":0,"prefix":"","suffix":"於是焉河伯欣然自喜，以天","prompt":"秋水时至，百川灌河，泾流之大，两涘渚崖之间，不辩牛马。"},
    {"id":"zhuangzi-19","bookId":"zhuangzi","section":18,"title":"〈達生〉第十九","text":"達生之情者，不務生之所无以為；達命之情者，不務知之所无奈何。","start":0,"prefix":"","suffix":"養形必先之以物，物有餘而","prompt":"达生之情者，不务生之所无以为；达命之情者，不务知之所无奈何。"},
    {"id":"zhuangzi-20","bookId":"zhuangzi","section":19,"title":"〈山木〉第二十","text":"且君子之交淡若水，小人之交甘若醴；君子淡以親，小人甘以絕。","start":1664,"prefix":"相收之與相棄亦遠矣。\n\n","suffix":"彼无故以合者，則无故以離","prompt":"且君子之交淡若水，小人之交甘若醴；君子淡以亲，小人甘以绝。"},
    {"id":"zhuangzi-22","bookId":"zhuangzi","section":21,"title":"〈知北遊〉第二十二","text":"天地有大美而不言，四時有明法而不議，萬物有成理而不說。","start":650,"prefix":"聞之，以黃帝為知言。\n\n","suffix":"聖人者，原天地之美而達萬","prompt":"天地有大美而不言，四时有明法而不议，万物有成理而不说。"},
    {"id":"zhuangzi-27","bookId":"zhuangzi","section":26,"title":"〈寓言〉第二十七","text":"寓言十九，重言十七，巵言日出，和以天倪。","start":0,"prefix":"","suffix":"\n\n寓言十九，藉外論之。"},
    {"id":"zhuangzi-28","bookId":"zhuangzi","section":27,"title":"〈讓王〉第二十八","text":"故天下大器也，而不以易生，此有道者之所以異乎俗者也。","start":140,"prefix":"且治之，未暇治天下也。」","suffix":"\n\n舜以天下讓善卷，善卷","prompt":"故天下大器也，而不以易生，此有道者之所以异乎俗者也。"}
  ];
  // The answer screen and source links use text. The neutral-script prompt
  // prevents the different scripts of the three editions from revealing a book.
  const bank = Object.freeze(rows.map(row => Object.freeze({ ...row, prompt: row.prompt || row.text })));
  if (typeof module === 'object' && module.exports) module.exports = bank;
  else globalThis.EarthDailyCanonBank = bank;
})();
