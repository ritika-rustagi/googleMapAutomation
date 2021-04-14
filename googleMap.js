let fs = require("fs");
let nodemailer=require("nodemailer");
let puppeteer = require('puppeteer');
let credentialsFile=process.argv[5];
let myEmail
let pwd;
let to1=process.argv[4];
let firstloc=process.argv[2];
let secondloc=process.argv[3];
let pathname;
let details;
let pdescr;
let allroutes=[];

(async function(){

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        slowMo:30,
        args: ['--start-maximized', '--disable-notifications', '--incognito']
        
    });

    let pages=await browser.pages();
    let tab=pages[0];
    tab.goto("https://www.google.com/maps",{
      waitUntil: "networkidle2",
    });
    console.log("Page Loading.....");
   await tab.waitForSelector("#searchbox-directions");
   await navigationHelper(tab,"#searchbox-directions");
   console.log("clicked on direction button");
   await tab.waitForSelector("#sb_ifc51");
   await tab.type("#sb_ifc51",firstloc);
   await Promise.all([tab.waitForNavigation({
    waitUntil:"networkidle2",
    
}),tab.keyboard.press('Enter')]);
   await tab.waitForSelector("#sb_ifc52");
   await tab.type("#sb_ifc52",secondloc);
   await Promise.all([tab.waitForNavigation({
    waitUntil:"networkidle2",
    
}),tab.keyboard.press('Enter')]);
console.log("Direcions entered");
//sb_ifc51
//sb_ifc52
await tab.waitForSelector('.section-directions-trip.clearfix',{visible : true});
let arr = await tab.$$('.section-directions-trip.clearfix');
console.log("No. of roots "+arr.length);
console.log("Fetching Roots");
for(let i=0;i<arr.length;i++){

  let p=await arr[i].$$('div.section-directions-trip-numbers >div');
  //console.log(p.length);
  if(p.length==2){

  await arr[i].$("div.section-directions-trip-description h1.section-directions-trip-title");
//console.log("found");

  let clas = await ( await arr[i].getProperty('className') ).jsonValue()
  
 
  pathname = await(await arr[i].$("div.section-directions-trip-description h1.section-directions-trip-title")).getProperty("textContent");
  pathname =await pathname.jsonValue();
  //console.log(pathname);
  await arr[i].$("div.section-directions-trip-description div.section-directions-trip-summary");
  pdescr = await(await arr[i].$("div.section-directions-trip-description div.section-directions-trip-summary")).getProperty("textContent");
  pdescr  = await pdescr .jsonValue();
  //console.log(pdescr);
  await tab.waitForSelector
  details = await(await arr[i].$("div.section-directions-trip-description div.section-directions-trip-numbers")).getProperty("textContent");
  details = await details.jsonValue();
  details=details.replace("  Arrive around    Leave around  ","");
  details=details.replace("typically ","");
  //console.log(details);
  await arr[i].click();
  if(i!=0){
  await tab.waitForSelector('button[aria-labelledby=section-directions-trip-details-msg-'+i+']',{visible : true});
  await tab.click('button[aria-labelledby=section-directions-trip-details-msg-'+i+']')
 }
 
 let singleroute={};
 singleroute.pathname=pathname.trim();
 singleroute.pdescr=pdescr.trim();
 singleroute.details=details;
 singleroute.directions=await routedetails(tab);
 allroutes.push(singleroute);
 
 await tab.screenshot({path : './screenshot'+i+'.png', clip :{ x:410, y:0 ,width :960 ,height:650 }});

 await tab.waitForSelector('button.section-trip-header-back',{visible: true})
 await tab.click("button.section-trip-header-back");
 await tab.waitForSelector('div.section-directions-trip.clearfix',{visible: true})
 arr = await tab.$$('div.section-directions-trip.clearfix');

 console.log(i+1 +" root fetched ");
  }
}
console.log("Json file creating...");



await fs.promises.writeFile('AllRoutesInone.json',JSON.stringify(allroutes));
console.log("Json file created");
let data = await fs.promises.readFile("AllRoutesInone.json", "utf-8");
let paths = JSON.parse(data);
console.log("Html file creating...");
await toHTML(paths); 
console.log("Html file created");
console.log("Pdf file creating..");
 await pdfconverter();
 console.log("Pdf file created..");
 await browser.close();

 await gmailsend();
})();

async function navigationHelper(tab,selector){
  await Promise.all([tab.waitForNavigation({
     waitUntil:"networkidle2",
     
 }),tab.click(selector)]);
}

async function routedetails(tab){
  try{
    let routeinfo = []
    await tab.waitForSelector('div.directions-mode-nontransit-groups', {visible : true})
    let allelements = await tab.$$('div.directions-mode-nontransit-groups div.directions-mode-group')
    
    let j = 0;
    while(j < allelements.length){
      let obj = {}
      let modesep,element,htext,extra
      let clas = await ( await allelements[j].getProperty('className') ).jsonValue()
      if(String(clas).includes("closed"))
      {
        htext = await allelements[j].$("div.directions-mode-group-summary h2.directions-mode-group-title")
        htext= await ( await htext.getProperty('textContent') ).jsonValue()
          //console.log(htext);
          modesep = await allelements[j].$("div.directions-mode-group-summary div.directions-mode-separator")
          modesep = await ( await modesep.getProperty('textContent') ).jsonValue()
          //console.log(modesep);
          obj.heading = htext.trim()
          obj.details = modesep.trim()
          await allelements[j].click()
          obj.steps = await closedpathdetails(allelements[j])
      }
      else{

        element = await allelements[j].$(" div.directions-mode-step-container div.directions-mode-step-summary div.numbered-step")
        element = await ( await element.getProperty('textContent') ).jsonValue()
      //console.log(element);
      extra = await allelements[j].$(" div.directions-mode-step-container div.directions-mode-step-summary div.dirsegnote")
      extra = await ( await extra.getProperty('textContent') ).jsonValue()
    
      modesep = await allelements[j].$("div.directions-mode-step div.directions-mode-separator")
      modesep = await ( await modesep.getProperty('textContent') ).jsonValue()
      //console.log(modesep);
      obj.heading = element.trim()
      obj.details = modesep.trim()
      if(extra != null && extra.trim().length > 0){
      obj.extra = extra.replace("Confidential","").trim()
      //console.log(obj.extra);
      
      }
    }
     j++; 
     routeinfo.push(obj);

    }
    return routeinfo;
  }
  catch(err)
    {
        console.log(err)
    }
}
async function closedpathdetails(div)
{
    try{
        let arr = []
        steps = await div.$$("div.hideable.expand-print.padded-hideable div.directions-mode-step-container ")
        let i = 0;
        
        while(i < steps.length)
        {
            
            let modesep,element,extra
            let obj = {}
            element = await steps[i].$(" div.directions-mode-step-summary div.numbered-step")
            element = await ( await element.getProperty('textContent') ).jsonValue()
            //console.log(element);
            extra = await steps[i].$(" div.directions-mode-step-summary div.dirsegnote")
            extra = await ( await extra.getProperty('textContent') ).jsonValue()
            
            modesep = await steps[i].$$("div.directions-mode-separator")
            modesep = await ( await modesep[1].getProperty('textContent') ).jsonValue()
          //  console.log(modesep);
            obj.heading = element.trim()
            obj.details = modesep.trim()
            if(extra != null && extra.trim().length > 0){
            obj.extra = extra.replace("Confidential","").trim()
        //    console.log(extra);
            }
            arr.push(obj)
            i++
        }

        return arr
    }
    catch(err)
    {
        console.log(err)
    }
}

async function pdfconverter(){
  const browser = await puppeteer.launch({
    headless:true
  });
  const tab = await browser.newPage();
  await tab.goto("C:\\Users\\user\\Desktop\\pep 2020\\dev\\pep hackathon\\paths.html",{
    waitUntil:"load"
  })
  await tab.pdf({ path: './page2.pdf'}); 
  browser.close();
}

async function toHTML(paths) {
  
  let html=
    '<link rel="stylesheet" href="styles.css">'
    html+=`<h1 style="text-align:center ;color:red"> There are ${paths.length} valid roots from ${firstloc} to ${secondloc} </h1>`
    html += paths
    
		.map((path,idx) => {
            let pathHtml = `
            
                <h1 style="                 
                
                margin-left: 30px;color:blue"
               >${idx+1+"."} ${path.pathname}</h1>
                <p style="margin-left: 30px">${path.pdescr}</p>
                <p style="margin-left: 40px">${path.details}</p>
                <img src='screenshot${idx}.png' style="margin-left: 30px">
            `;
			pathHtml += path.directions
				.map((direction) => {
					let directionHTML = "";
					if (direction.extra) {
						directionHTML += `
                <h4 style="margin-left: 30px">${direction.heading}</h4>
                <p style="margin-left: 40px">${direction.details}</p>
                <p style="margin-left: 40px">${direction.extra}</p>
                `;
					} else {
						directionHTML += `
                <h4 style="margin-left: 30px">${direction.heading}</h4>
                <p style="margin-left: 40px">${direction.details}</p>`;
					}
					if (direction.steps) {
						directionHTML += direction.steps
							.map((step) => {
								if (step.extra) {
									return `
                        <h4 style="margin-left: 30px">${step.heading}</h4>
                        <p style="margin-left: 40px">${step.details}</p>
                        <p style="margin-left: 40px">${step.extra}</p>
                        `;
								} else {
									return `
                        <h4 style="margin-left: 30px">${step.heading}</h4>
                        <p style="margin-left: 40px">${step.details}<p>`;
								}
							})
							.join(" ");
						return directionHTML;
					}
				})
				.join(" ");

			return pathHtml;
		})
		.join(" ");
	await fs.promises.writeFile("paths.html", html);

	//console.log(html);
}

async function gmailsend(){
  let data = await fs.promises.readFile(credentialsFile, "utf-8");
    let credentials = JSON.parse(data);
    myEmail = credentials.myEmail;
    pwd = credentials.pwd;
  let transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,  //587 for false
    secure: true, // use SSL
    service: "gmail",
    auth: {
      user: myEmail,
      pass: pwd,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  let message = {
    from: myEmail,
    to: to1,
    subject: "Map",
    text: "Here is your Map!",
    attachments: [
      {
        filename: "ritika.pdf",
        path: `./page2.pdf`,
      },
    ],
  };
  transport.sendMail(message, function (err) {
    if (err) {
      console.log("Failed to send email.\n" + err.message);
      return;
    }
    console.log(`Email sent to ${to1} \n check your email.`);
  });
}