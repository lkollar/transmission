/**
 * Copyright © Jordan Lee, Dave Perrett, Malcolm Jarvis and Bruno Bierbaumer
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

function Inspector(controller) {

    var data = {
        controller: null,
        elements: { },
        torrents: [ ]
    },

    needsExtraInfo = function (torrents) {
        var i, id, tor;

        for (i = 0; tor = torrents[i]; i++)
            if (!tor.hasExtraInfo())
                return true;

        return false;
    },

    refreshTorrents = function () {
        var fields,
            ids = $.map(data.torrents.slice(0), function (t) {return t.getId();});

        if (ids && ids.length)
        {
            fields = ['id'].concat(Torrent.Fields.StatsExtra);

            if (needsExtraInfo(data.torrents))
                $.merge(fields, Torrent.Fields.InfoExtra);

            data.controller.updateTorrents(ids, fields);
        }
    },

    onTabClicked = function (ev) {
        var tab = ev.currentTarget;

        if (isMobileDevice)
            ev.stopPropagation();

        // select this tab and deselect the others
        $(tab).addClass('selected').siblings().removeClass('selected');

        // show this tab and hide the others
        $('#' + tab.id.replace('tab','page')).show().siblings('.inspector-page').hide();

        updateInspector();
    },

    updateInspector = function () {
        var e = data.elements,
            torrents = data.torrents,
            name;

        // update the name, which is shown on all the pages
        if (!torrents || !torrents.length)
            name = 'No Selection';
        else if(torrents.length === 1)
            name = torrents[0].getName();
        else
            name = '' + torrents.length+' Transfers Selected';
        setTextContent(e.name_lb, name || na);

        // update the visible page
        if ($(e.info_page).is(':visible'))
            updateInfoPage();
        else if ($(e.peers_page).is(':visible'))
            updatePeersPage();
        else if ($(e.trackers_page).is(':visible'))
            updateTrackersPage();
        else if ($(e.files_page).is(':visible'))
            updateFilesPage();
    },

    /****
    *****  GENERAL INFO PAGE
    ****/

    accumulateString = function (oldVal, newVal) {
        if (!oldVal || !oldVal.length)
            return newVal;
        if (oldVal === newVal)
            return newVal;
        return 'Mixed';
    },

    updateInfoPage = function () {
        var torrents = data.torrents,
            e = data.elements,
            fmt = Transmission.fmt,
            none = 'None',
            mixed = 'Mixed',
            unknown = 'Unknown',
            isMixed, allPaused, allFinished,
            str,
            baseline, it, s, i, t,
            sizeWhenDone = 0,
            leftUntilDone = 0,
            available = 0,
            haveVerified = 0,
            haveUnverified = 0,
            verifiedPieces = 0,
            stateString,
            latest,
            pieces,
            size,
            pieceSize,
            creator, mixed_creator,
            date, mixed_date,
            v, u, f, d, pct,
            now = Date.now();

        //
        //  state_lb
        //

        if(torrents.length <1)
            str = none;
        else {
            isMixed = false;
            allPaused = true;
            allFinished = true;

            baseline = torrents[0].getStatus();
            for(i=0; t=torrents[i]; ++i) {
                it = t.getStatus();
                if(it != baseline)
                    isMixed = true;
                if(!t.isStopped())
                    allPaused = allFinished = false;
                if(!t.isFinished())
                    allFinished = false;
            }
            if( isMixed )
                str = mixed;
            else if( allFinished )
                str = 'Finished';
            else if( allPaused )
                str = 'Paused';
            else
                str = torrents[0].getStateString();
        }
        setTextContent(e.state_lb, str);
        stateString = str;

        //
        //  have_lb
        //

        if(torrents.length < 1)
            str = none;
        else {
            baseline = torrents[0].getStatus();
            for(i=0; t=torrents[i]; ++i) {
                if(!t.needsMetaData()) {
                    haveUnverified += t.getHaveUnchecked();
                    v = t.getHaveValid();
                    haveVerified += v;
                    if(t.getPieceSize())
                        verifiedPieces += v / t.getPieceSize();
                    sizeWhenDone += t.getSizeWhenDone();
                    leftUntilDone += t.getLeftUntilDone();
                    available += (t.getHave()) + t.getDesiredAvailable();
                }
            }

            d = 100.0 * ( sizeWhenDone ? ( sizeWhenDone - leftUntilDone ) / sizeWhenDone : 1 );
            str = fmt.percentString( d );

            if( !haveUnverified && !leftUntilDone )
                str = fmt.size(haveVerified) + ' (100%)';
            else if( !haveUnverified )
                str = fmt.size(haveVerified) + ' of ' + fmt.size(sizeWhenDone) + ' (' + str +'%)';
            else
                str = fmt.size(haveVerified) + ' of ' + fmt.size(sizeWhenDone) + ' (' + str +'%), ' + fmt.size(haveUnverified) + ' Unverified';
        }
        setTextContent(e.have_lb, str);

        //
        //  availability_lb
        //

        if(torrents.length < 1)
            str = none;
        else if( sizeWhenDone == 0 )
            str = none;
        else
            str = '' + fmt.percentString( ( 100.0 * available ) / sizeWhenDone ) +  '%';
        setTextContent(e.availability_lb, str);

        //
        //  downloaded_lb
        //

        if(torrents.length < 1)
            str = none;
        else {
            d = f = 0;
            for(i=0; t=torrents[i]; ++i) {
                d += t.getDownloadedEver();
                f += t.getFailedEver();
            }
            if(f)
                str = fmt.size(d) + ' (' + fmt.size(f) + ' corrupt)';
            else
                str = fmt.size(d);
        }
        setTextContent(e.downloaded_lb, str);

        //
        //  uploaded_lb
        //

        if(torrents.length < 1)
            str = none;
        else {
            d = u = 0;
            if(torrents.length == 1) {
				d = torrents[0].getDownloadedEver();
				u = torrents[0].getUploadedEver();
				
				if (d == 0)
					d = torrents[0].getHaveValid();
            }
            else {
				for(i=0; t=torrents[i]; ++i) {
					d += t.getDownloadedEver();
					u += t.getUploadedEver();
				}
			}
            str = fmt.size(u) + ' (Ratio: ' + fmt.ratioString( Math.ratio(u,d))+')';
        }
        setTextContent(e.uploaded_lb, str);

        //
        // running time
        //

        if(torrents.length < 1)
            str = none;
        else {
            allPaused = true;
            baseline = torrents[0].getStartDate();
            for(i=0; t=torrents[i]; ++i) {
                if(baseline != t.getStartDate())
                    baseline = 0;
                if(!t.isStopped())
                    allPaused = false;
            }
            if(allPaused)
                str = stateString; // paused || finished
            else if(!baseline)
                str = mixed;
            else
                str = fmt.timeInterval(now/1000 - baseline);
        }
        setTextContent(e.running_time_lb, str);

        //
        // remaining time
        //

        str = '';
        if(torrents.length < 1)
            str = none;
        else {
            baseline = torrents[0].getETA();
            for(i=0; t=torrents[i]; ++i) {
                if(baseline != t.getETA()) {
                    str = mixed;
                    break;
                }
            }
        }
        if(!str.length) {
            if(baseline < 0)
                str = unknown;
            else
                str = fmt.timeInterval(baseline);
        }
        setTextContent(e.remaining_time_lb, str);

        //
        // last activity
        //

        latest = -1;
        if(torrents.length < 1)
            str = none;
        else {
            baseline = torrents[0].getLastActivity();
            for(i=0; t=torrents[i]; ++i) {
                d = t.getLastActivity();
                if(latest < d)
                    latest = d;
            }
            d = now/1000 - latest; // seconds since last activity
            if(d < 0)
                str = none;
            else if(d < 5)
                str = 'Active now';
            else
                str = fmt.timeInterval(d) + ' ago';
        }
        setTextContent(e.last_activity_lb, str);

        //
        // error
        //

        if(torrents.length < 1)
            str = none;
        else {
            str = torrents[0].getErrorString();
            for(i=0; t=torrents[i]; ++i) {
                if(str != t.getErrorString()) {
                    str = mixed;
                    break;
                }
            }
        }
        setTextContent(e.error_lb, str || none);

        //
        // size
        //

        if(torrents.length < 1)
            str = none;
        else {
            pieces = 0;
            size = 0;
            pieceSize = torrents[0].getPieceSize();
            for(i=0; t=torrents[i]; ++i) {
                pieces += t.getPieceCount();
                size += t.getTotalSize();
                if(pieceSize != t.getPieceSize())
                    pieceSize = 0;
            }
            if(!size)
                str = none;
            else if(pieceSize > 0)
                str = fmt.size(size) + ' (' + pieces.toStringWithCommas() + ' pieces @ ' + fmt.mem(pieceSize) + ')';
            else
                str = fmt.size(size) + ' (' + pieces.toStringWithCommas() + ' pieces)';
        }
        setTextContent(e.size_lb, str);

        //
        //  hash
        //

        if(torrents.length < 1)
            str = none;
        else {
            str = torrents[0].getHashString();
            for(i=0; t=torrents[i]; ++i) {
                if(str != t.getHashString()) {
                    str = mixed;
                    break;
                }
            }
        }
        setTextContent(e.hash_lb, str);

        //
        //  privacy
        //

        if(torrents.length < 1)
            str = none;
        else {
            baseline = torrents[0].getPrivateFlag();
            str = baseline ? 'Private to this tracker -- DHT and PEX disabled' : 'Public torrent';
            for(i=0; t=torrents[i]; ++i) {
                if(baseline != t.getPrivateFlag()) {
                    str = mixed;
                    break;
                }
            }
        }
        setTextContent(e.privacy_lb, str);

        //
        //  comment
        //

        if(torrents.length < 1)
            str = none;
        else {
            str = torrents[0].getComment();
            for(i=0; t=torrents[i]; ++i) {
                if(str != t.getComment()) {
                    str = mixed;
                    break;
                }
            }
        }
        if(!str)
            str = none;  
        setTextContent(e.comment_lb, str.replace(/(https?|ftp):\/\/([\w\-]+(\.[\w\-]+)*(\.[a-z]{2,4})?)(\d{1,5})?(\/([^<>\s]*))?/g, '<a target="_blank" href="$&">$&</a>'));

        //
        //  origin
        //

        if(torrents.length < 1)
            str = none;
        else {
            mixed_creator = false;
            mixed_date = false;
            creator = torrents[0].getCreator();
            date = torrents[0].getDateCreated();
            for(i=0; t=torrents[i]; ++i) {
                if(creator != t.getCreator())
                    mixed_creator = true;
                if(date != t.getDateCreated())
                    mixed_date = true;
            }
            if(mixed_creator && mixed_date)
                str = mixed;
            else if(mixed_date && creator.length)
                str = 'Created by ' + creator;
            else if(mixed_creator && date)
                str = 'Created on ' + (new Date(date*1000)).toDateString();
            else
                str = 'Created by ' + creator + ' on ' + (new Date(date*1000)).toDateString();
        }
        setTextContent(e.origin_lb, str);

        //
        //  foldername
        //

        if(torrents.length < 1)
            str = none;
        else {
            str = torrents[0].getDownloadDir();
            for(i=0; t=torrents[i]; ++i) {
                if(str != t.getDownloadDir()) {
                    str = mixed;
                    break;
                }
            }
        }
        setTextContent(e.foldername_lb, str);
    },

    /****
    *****  FILES PAGE
    ****/

    changeFileCommand = function(rows, command) {
        var torrentId = data.file_torrent.getId();
        var rowIndices = $.map(rows.slice(0),function (row) {return row.getIndex();});
        data.controller.changeFileCommand(torrentId, rowIndices, command);
    },

    selectAllFiles = function() {
        changeFileCommand([], 'files-wanted');
    },

    deselectAllFiles = function() {
        changeFileCommand([], 'files-unwanted');
    },

    onFileWantedToggled = function(ev, row, want) {
        changeFileCommand([row], want?'files-wanted':'files-unwanted');
    },

    onFilePriorityToggled = function(ev, row, priority) {
        var command;
        switch(priority) {
            case -1: command = 'priority-low'; break;
            case  1: command = 'priority-high'; break;
            default: command = 'priority-normal'; break;
        }
        changeFileCommand([row], command);
    },

    clearFileList = function() {
        $(data.elements.file_list).empty();
        delete data.file_torrent;
        delete data.file_rows;
    },

    updateFilesPage = function() {
        var i, n, sel, row, tor, fragment,
            file_list = data.elements.file_list,
            torrents = data.torrents;

        if (torrents.length !== 1) {
            clearFileList();
            return;
        }

        // build the file list
        tor = torrents[0];

        for (parentid in data.parents) {
            data.parents[parentid] = $('#'+parentid).children('li').css('display')
        }
        clearFileList();
        data.file_torrent = tor;
        n = tor.getFileCount();
        data.file_rows = [];
        fragment = document.createDocumentFragment();
		heirarchy = {'/':[]}
        
        for (i=0; i<n; ++i) {
            row = data.file_rows[i] = new FileRow(tor, i);
            fragment.appendChild(row.getElement());
                    $(row).bind('wantedToggled',onFileWantedToggled);
                    $(row).bind('priorityToggled',onFilePriorityToggled);
            path = row.getPath();
            if (path.length == 1) {
                heirarchy['/'].push(path[0]);
            } else {
                subheirarchy = heirarchy;
                for (j=0; j<path.length; j++) {
                    if (j<(path.length-1)) {
                        subheirarchy[path[j]] = (subheirarchy[path[j]] == undefined) ? {'/':[]} : subheirarchy[path[j]];
                        subheirarchy[path[j]]['PARENT'] = (path[j-1] == undefined) ? [undefined] : [path[j-1].replace(/[\[\] ().]/g,'_')]
                        subheirarchy = subheirarchy[path[j]];
                    } else {
                        parentid  = (path[j-1] == undefined) ? [undefined] : [path[j-1].replace(/[\[\] ().]/g,'_')]
                        subheirarchy['/'].push([path[j],parentid]);
                    }
                }
            }
        }
        /*
        At this point we have a single object containing the whole
        torrent heirarchy. The '/' key is file element ids as assigned above
        for the current level. Any other keys are array objects which are
        directories in the torrent heirarchy, this will also contain a '/'
        key and potentially more keys for nested directories.
        */
        connections = [];
        parents = {};
        var recursiveCreate = function(key,val) {
            if (key == "PARENT") { return; }
            if (typeof(val) == "object" &&! Array.isArray(val)) {
                row = document.createElement('li');
                row.id = key.replace(/[\[\] ().]/g,'_');
                row.classname = 'inspector_torrent_file_list_entry odd';

                e = document.createElement('input');
                e.type = 'checkbox';
                e.className = "file_wanted_control";
                e.title = 'Download file';
                e.checked = true;
                $(e).change(function() { $($(this).parent()).children('li').children('input').click() });
                row.appendChild(e);

                e = document.createElement('div');
                e.className = 'file-priority-radiobox';
                box = e;

                        e = document.createElement('div');
                        e.className = 'low';
                        e.title = 'Low Priority';
                        $(e).click(function(){ $($(this).parent().parent()).children('li').children('div').children('.low').click() });
                        box.appendChild(e);

                        e = document.createElement('div');
                        e.className = 'normal';
                        e.title = 'Normal Priority';
                        $(e).click(function(){ $($(this).parent().parent()).children('li').children('div').children('.normal').click() });
                        box.appendChild(e);

                        e = document.createElement('div');
                        e.title = 'High Priority';
                        e.className = 'high';
                        $(e).click(function(){ $($(this).parent().parent()).children('li').children('div').children('.high').click() });
                        box.appendChild(e);

                row.appendChild(box);

                inner = document.createElement('div');
                inner.className = "inspector_torrent_file_list_entry_name";
                inner.innerHTML = key;
                row.appendChild(inner);

                complete = document.createElement('div');
                complete.className = "inspector_torrent_file_list_entry_progress";
                complete.innerHTML = "&nbsp;"
                row.appendChild(complete)

                fragment.appendChild(row);
                connections.push([key.replace(/[\[\] ().]/g,'_'),val['PARENT'][0]])
            } else {
                for (item in val) {
                    parents[val[item][1][0]] = ""
                }
                connections.push.apply(connections,val)
            }
            if (!Array.isArray(val)) {
                $.each(val,function(key,val) { recursiveCreate(key,val) })
            }
        }
        $.each(heirarchy,function(key,val) { recursiveCreate(key,val) })
        file_list.appendChild(fragment);
        for (conn in connections) {
            from = connections[conn][0];
            to = connections[conn][1];
            if (to == undefined) { continue; }
            $('#'+from).appendTo($('#'+to));
            $('#'+from).css('margin-left','20px')
        }
        for (parentid in parents) {
            $($('.inspector_torrent_file_list_entry_name',$('#'+parentid))[0]).click(function() { $($(this).parent()).children('li').toggle(); })

            sum = 0
            matches = $('#'+parentid).children('li').text().match(/\([^\.]+\)/g)
            if (matches == null) { continue; }
            matches.map(function(word) {return parseFloat(word.slice(1,-2)) }).map(function(perc) {sum+=perc})
            count = $('#'+parentid).children('li').text().match(/\([^\.]+\)/g).length
            totalcomplete = (sum/count).toFixed(1)

            $($('.inspector_torrent_file_list_entry_progress',$('#'+parentid))[0]).text('('+totalcomplete+'%)')
        }
        for (parentid in data.parents) {
            $('#'+parentid).children('li').css('display',data.parents[parentid])
        }
        data.parents = parents;
    },

    /****
    *****  PEERS PAGE
    ****/

    updatePeersPage = function() {
        var i, k, tor, peers, peer, parity,
            html = [],
            fmt = Transmission.fmt,
            peers_list = data.elements.peers_list,
            torrents = data.torrents;

        for (k=0; tor=torrents[k]; ++k)
        {
            peers = tor.getPeers();
            html.push('<div class="inspector_group">');
            if (torrents.length > 1) {
                html.push('<div class="inspector_torrent_label">', sanitizeText(tor.getName()), '</div>');
            }
            if (!peers || !peers.length) {
                html.push('<br></div>'); // firefox won't paint the top border if the div is empty
                continue;
            }
            html.push('<table class="peer_list">',
                   '<tr class="inspector_peer_entry even">',
                   '<th class="encryptedCol"></th>',
                   '<th class="upCol">Up</th>',
                   '<th class="downCol">Down</th>',
                   '<th class="percentCol">%</th>',
                   '<th class="statusCol">Status</th>',
                   '<th class="addressCol">Address</th>',
                   '<th class="clientCol">Client</th>',
                   '</tr>');
            for (i=0; peer=peers[i]; ++i) {
                parity = (i%2) ? 'odd' : 'even';
                html.push('<tr class="inspector_peer_entry ', parity, '">',
                       '<td>', (peer.isEncrypted ? '<div class="encrypted-peer-cell" title="Encrypted Connection">'
                                                 : '<div class="unencrypted-peer-cell">'), '</div>', '</td>',
                       '<td>', (peer.rateToPeer ? fmt.speedBps(peer.rateToPeer) : ''), '</td>',
                       '<td>', (peer.rateToClient ? fmt.speedBps(peer.rateToClient) : ''), '</td>',
                       '<td class="percentCol">', Math.floor(peer.progress*100), '%', '</td>',
                       '<td>', fmt.peerStatus(peer.flagStr), '</td>',
                       '<td>', sanitizeText(peer.address), '</td>',
                       '<td class="clientCol">', sanitizeText(peer.clientName), '</td>',
                       '</tr>');
            }
            html.push('</table></div>');
        }

        setInnerHTML(peers_list, html.join(''));
    },

    /****
    *****  TRACKERS PAGE
    ****/

    getAnnounceState = function(tracker) {
        var timeUntilAnnounce, s = '';
        switch (tracker.announceState) {
            case Torrent._TrackerActive:
                s = 'Announce in progress';
                break;
            case Torrent._TrackerWaiting:
                timeUntilAnnounce = tracker.nextAnnounceTime - ((new Date()).getTime() / 1000);
                if (timeUntilAnnounce < 0) {
                    timeUntilAnnounce = 0;
                }
                s = 'Next announce in ' + Transmission.fmt.timeInterval(timeUntilAnnounce);
                break;
            case Torrent._TrackerQueued:
                s = 'Announce is queued';
                break;
            case Torrent._TrackerInactive:
                s = tracker.isBackup ?
                    'Tracker will be used as a backup' :
                    'Announce not scheduled';
                break;
            default:
                s = 'unknown announce state: ' + tracker.announceState;
        }
        return s;
    },

    lastAnnounceStatus = function(tracker) {

        var lastAnnounceLabel = 'Last Announce',
            lastAnnounce = [ 'N/A' ],
        lastAnnounceTime;

        if (tracker.hasAnnounced) {
            lastAnnounceTime = Transmission.fmt.timestamp(tracker.lastAnnounceTime);
            if (tracker.lastAnnounceSucceeded) {
                lastAnnounce = [ lastAnnounceTime, ' (got ',  Transmission.fmt.plural(tracker.lastAnnouncePeerCount, 'peer'), ')' ];
            } else {
                lastAnnounceLabel = 'Announce error';
                lastAnnounce = [ (tracker.lastAnnounceResult ? (tracker.lastAnnounceResult + ' - ') : ''), lastAnnounceTime ];
            }
        }
        return { 'label':lastAnnounceLabel, 'value':lastAnnounce.join('') };
    },

    lastScrapeStatus = function(tracker) {

        var lastScrapeLabel = 'Last Scrape',
            lastScrape = 'N/A',
        lastScrapeTime;

        if (tracker.hasScraped) {
            lastScrapeTime = Transmission.fmt.timestamp(tracker.lastScrapeTime);
            if (tracker.lastScrapeSucceeded) {
                lastScrape = lastScrapeTime;
            } else {
                lastScrapeLabel = 'Scrape error';
                lastScrape = (tracker.lastScrapeResult ? tracker.lastScrapeResult + ' - ' : '') + lastScrapeTime;
            }
        }
        return {'label':lastScrapeLabel, 'value':lastScrape};
    },

    updateTrackersPage = function() {
        var i, j, tier, tracker, trackers, tor,
            html, parity, lastAnnounceStatusHash,
            announceState, lastScrapeStatusHash,
            na = 'N/A',
            trackers_list = data.elements.trackers_list,
            torrents = data.torrents;

        // By building up the HTML as as string, then have the browser
        // turn this into a DOM tree, this is a fast operation.
        html = [];
        for (i=0; tor=torrents[i]; ++i)
        {
            html.push ('<div class="inspector_group">');

            if (torrents.length > 1)
                html.push('<div class="inspector_torrent_label">', tor.getName(), '</div>');

            tier = -1;
            trackers = tor.getTrackers();
            for (j=0; tracker=trackers[j]; ++j)
            {
                if (tier != tracker.tier)
                {
                    if (tier !== -1) // close previous tier
                        html.push('</ul></div>');

                    tier = tracker.tier;

                    html.push('<div class="inspector_group_label">',
                          'Tier ', tier, '</div>',
                          '<ul class="tier_list">');
                }

                // Display construction
                lastAnnounceStatusHash = lastAnnounceStatus(tracker);
                announceState = getAnnounceState(tracker);
                lastScrapeStatusHash = lastScrapeStatus(tracker);
                parity = (j%2) ? 'odd' : 'even';
                html.push('<li class="inspector_tracker_entry ', parity, '"><div class="tracker_host" title="', sanitizeText(tracker.announce), '">',
                      sanitizeText(tracker.host), '</div>',
                      '<div class="tracker_activity">',
                      '<div>', lastAnnounceStatusHash['label'], ': ', lastAnnounceStatusHash['value'], '</div>',
                      '<div>', announceState, '</div>',
                      '<div>', lastScrapeStatusHash['label'], ': ', lastScrapeStatusHash['value'], '</div>',
                      '</div><table class="tracker_stats">',
                      '<tr><th>Seeders:</th><td>', (tracker.seederCount > -1 ? tracker.seederCount : na), '</td></tr>',
                      '<tr><th>Leechers:</th><td>', (tracker.leecherCount > -1 ? tracker.leecherCount : na), '</td></tr>',
                      '<tr><th>Downloads:</th><td>', (tracker.downloadCount > -1 ? tracker.downloadCount : na), '</td></tr>',
                      '</table></li>');
            }
            if (tier !== -1) // close last tier
                    html.push('</ul></div>');

            html.push('</div>'); // inspector_group
        }

        setInnerHTML (trackers_list, html.join(''));
    },

    initialize = function (controller) {

        var ti = '#torrent_inspector_';

        data.controller = controller;

        $('.inspector-tab').click(onTabClicked);

        data.elements.info_page      = $('#inspector-page-info')[0];
        data.elements.files_page     = $('#inspector-page-files')[0];
        data.elements.peers_page     = $('#inspector-page-peers')[0];
        data.elements.trackers_page  = $('#inspector-page-trackers')[0];

        data.elements.file_list      = $('#inspector_file_list')[0];
        data.elements.peers_list     = $('#inspector_peers_list')[0];
        data.elements.trackers_list  = $('#inspector_trackers_list')[0];

	data.elements.have_lb           = $('#inspector-info-have')[0];
	data.elements.availability_lb   = $('#inspector-info-availability')[0];
	data.elements.downloaded_lb     = $('#inspector-info-downloaded')[0];
	data.elements.uploaded_lb       = $('#inspector-info-uploaded')[0];
	data.elements.state_lb          = $('#inspector-info-state')[0];
	data.elements.running_time_lb   = $('#inspector-info-running-time')[0];
	data.elements.remaining_time_lb = $('#inspector-info-remaining-time')[0];
	data.elements.last_activity_lb  = $('#inspector-info-last-activity')[0];
	data.elements.error_lb          = $('#inspector-info-error')[0];
	data.elements.size_lb           = $('#inspector-info-size')[0];
	data.elements.foldername_lb     = $('#inspector-info-location')[0];
	data.elements.hash_lb           = $('#inspector-info-hash')[0];
	data.elements.privacy_lb        = $('#inspector-info-privacy')[0];
	data.elements.origin_lb         = $('#inspector-info-origin')[0];
	data.elements.comment_lb        = $('#inspector-info-comment')[0];
        data.elements.name_lb           = $('#torrent_inspector_name')[0];

        // file page's buttons
        $('#select-all-files').click(selectAllFiles);
        $('#deselect-all-files').click(deselectAllFiles);

        // force initial 'N/A' updates on all the pages
        updateInspector();
        updateInfoPage();
        updatePeersPage();
        updateTrackersPage();
        updateFilesPage();
    };

    /****
    *****  PUBLIC FUNCTIONS
    ****/

    this.setTorrents = function (torrents) {
        var d = data;

        // update the inspector when a selected torrent's data changes.
        $(d.torrents).unbind('dataChanged.inspector');
        $(torrents).bind('dataChanged.inspector', $.proxy(updateInspector,this));
        d.torrents = torrents;

        // periodically ask for updates to the inspector's torrents
        clearInterval(d.refreshInterval);
        d.refreshInterval = setInterval($.proxy(refreshTorrents,this), 2000);
        refreshTorrents();

        // refresh the inspector's UI
        updateInspector();
    };

    initialize (controller);
};
