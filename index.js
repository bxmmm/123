const cheerio = require('cheerio');
const request = require('request');
const fs = require('fs');
const download = require('download');

// Ukucati koliko stranica zelimo obraditi i da li zelimo da se skidaju pdfovi
var howManyPages = 2
var download_pdf = true
// ----------------------------------------------------------------------------





var results = []
var itemResults = []
var ID_STRANICA = []

var counter = 0
settingLoop = howManyPages+1

// ako je i<2 onda ce samo prvi page biti obradjen
for (var i = 1; i<settingLoop; i++) {
	// URL je ovakav jer sam filtrirao rezultate na stranici, gdje sam odabrao engleski jezik
	request(`https://dp.la/search?language%5B%5D=English&page=${i}&q=&utf8=%E2%9C%93`, function(err, res, body) {
		if (!err && res.statusCode == 200) {
			var $ = cheerio.load(body);
			var json = []
			$('#content > article > div > section').each(function(n, elem) {
				var data = $(this);
				var title = data[0].attribs['data-title']
				var dataProvider = data[0].attribs['data-provider']
				var extractedCreator = data.children('.searchLeft').first().children('p').first().text()
				var extractedYear = data.children('.searchLeft').first().children('p').eq('1').text()
				
				var itemId = data[0].attribs['data-item-id']
				ID_STRANICA.push(itemId);
				
				// uljepsavanje kreatora i godine
				var creator = extractedCreator.slice(1).slice(0, extractedCreator.length-2);
				var year = extractedYear.slice(1).slice(0, extractedYear.length-2);
				var dataObject = { 
					title: title,
					dataProvider: dataProvider,
					creator: creator,
					year: year
				}
				results.push(dataObject)
			})


			counter++
			// kad zavrsi loop pokreni drugu funkciju koja otvara pojedinacno iteme i tu crawla
			// promjeniti broj da bude i-1, to ce omoguciti da se ovo execute-a kad sve prethodno zavrsi
			// 
			if (counter === howManyPages) {
				loopDone()
			}

		}

	})
}

// loopdone ce biti execute-ana kad zavrsi gornja petlja, i ona ulazi u svaki item pojedinacno i iz svakog itema
// pojedinacno moze uzimati
function loopDone () { 
	ID_STRANICA.forEach(function(id, index) {
		setTimeout(function() {
				request(`https://dp.la/item/${id}`, function(error, response, body) {

	// definisanje subject-a da bi ga mogao populate 
			var subject = []
			var locations = []
			
			if (!error && response.statusCode == 200) {
				var $ = cheerio.load(body);

// Selektuj li koji se zove Crator, Publisher, Created Date, pa selektuj sljedeci isti element
// stranica nema classe za pojedine elemente pa je ovo jedan od nacina da selektujem i dobijem vrijednost koju zelim
				 var creatorData = $('li:contains(Creator)').next()
				 var publisherData = $('li:contains(Publisher)').next()
				 var publish_date_word = $('li:contains(Created Date)').next()
				 var typeData = $('h6:contains(Type)').parent().next().text()

				 var formatData = $('li:contains(Format)').next().text()
				 var descriptionLongData = $('.desc-long').text()
 				 var descriptionShortData = $('.desc-short').text()

// kod za download PDF-a
 				 var URL_PDF = $('h6:contains(URL)').parent().next().children().text()

 			// pokretanje funkcije za download pdfa ako je download_pdf true
 				 if(download_pdf) {
 				 	downloadPDF(URL_PDF)
 				 }
 				 console.log('....')
				 // slice kraj descriptiona jer ima less i strelicu
	       var descriptionLong = descriptionLongData.slice(1 , descriptionLongData.length-9)

	   		// ako imamo samo short desc slice na kraju i na pocetku znakic, a ako imamo long onda moramo slice vise 
	       var descriptionShort = descriptionShortData.slice(1, descriptionShortData.length-1)
	       if(descriptionLong && descriptionLong.length > 0) {
	       	 descriptionShort = descriptionShortData.slice(1, descriptionShortData.length-9)
	       }

				 var subjectData = $('h6:contains(Location)').parent().next().children().each(function (nr, element) {
			 			var data = $(this);
				 		var singleLocation = data.text()
				 		if (singleLocation && singleLocation.length > 0) {
				 			locations.push(singleLocation)
				 		}
				 	})
									 
// obzirom da ima vise subject-a treba foreach
	 			 var subjectData = $('h6:contains(Subject)').parent().next().children().each(function (nr, element) {
					 var data = $(this);
			 		 var singleSubject = data.text()
// provjera jel postoji subject, ako ne vrati prazan array
					 if (singleSubject && singleSubject.length > 0) {
					 			subject.push(singleSubject)
					 	} 
					})

				 // Provjera ima li item uopste trazene pojmove, da ne bi dobijao errore zbog undefineda
				 if(creatorData[0] && creatorData[0].children[0].data !== undefined) {
				 		creator = creatorData[0].children[0].data
				 } else {
				 		creator = null
				 }

				 if (publisherData[0] && publisherData[0] !== undefined) {
				 		publisher = publisherData[0].children[0].data
				 } else {
				 		publisher = null
				 }
				 if (publish_date_word[0] && publish_date_word[0] !== undefined) {
// ako imamo datum, pozivamo funkciju formatdate 
						publish_date = formatDate(publish_date_word[0].children[0].data);
				 } else {
				 		publish_date = null
				 }
				 if (formatData && formatData !== undefined) {
				 	  format = formatData
				 } else {
				 	  format = null;
				 }
				 if ( typeData && typeData !== undefined) {
				 	  type = typeData
				 } else {
				 	 type = null;
				 }
				 var uniqueId = id


			  var itemData = { 
			  	creator: creator,
			  	publisher: publisher,
			  	publish_date: publish_date,
			  	format: format,
			  	type: type,
			  	subject: subject,
			  	locations: locations,
			  	descriptionLong: descriptionLong,
			  	descriptionShort: descriptionShort,
			  	uniqueId: uniqueId
			  };
			  itemResults.push(itemData);

			  fs.writeFile('rezultati-search-pagea.json', JSON.stringify(results, null, 4));	
			  fs.writeFile('rezultati-itema.json', JSON.stringify(itemResults, null, 4));	
		  }
		})
		





		}, 1000 * index)		
})
}

// funkcija za parse datuma 
function formatDate(date) {
	// parse datuma ako je 'between 1860 and 1883'
	if(date.length > 5 && date.startsWith('between', 0)) {
	var firstYear = date.slice(7, 12);
	var secondYear = date.slice(17, date.length);

	var firstYearJs = new Date(firstYear);
	var secondYearJs = new Date(secondYear);

	var finishedDate = Date.parse(firstYearJs) + '-' + Date.parse(secondYearJs)

	return finishedDate
}

	// parse datuma ako je npr '1915-'        ovdje dodajem od 1915 do trenutka parsanja (Date.now())
	if (date.length === 5 && date.startsWith('-', 4)) {
	var slicedYear = date.slice(0, 4)
	var jsDate = new Date(slicedYear)
	return Date.parse(jsDate) + '-' + Date.now()
	} 
  // ove ostale datume fino parsira vec
	else {
		var otherDate = new Date(date)
		return Date.parse(otherDate);
	}
}



function downloadPDF(URL_PDF) {
	// pravimo request na taj URL
	request(URL_PDF, function(err, response, body) {
		if(response && response.statusCode === 200) {
		// iz naseg requesta uzimamo path i formiramo final URL
		var pathUrl = response.request.req.path
		var COMPLETE_URL = `http://libsysdigi.library.illinois.edu${pathUrl}`

		request(COMPLETE_URL, function(error, res, bod) {
			if(res && res.statusCode === 404) {
				return
			} else {
			 	var $ = cheerio.load(body);
// selektujemo prvi pdf link da bi ga downloadali na novoj otvorenoj stranici za pristup pdf-u
				var URL = $('b').children('a')[0].attribs['href']
// pravimo url za download pdf-a
			 	var PDFURL = `${COMPLETE_URL}${URL}`

		 		download(PDFURL, 'pdf').then(() => {
					console.log('....');
				});
			}
		})	
		}

	})
}

