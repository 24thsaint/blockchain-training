$(document).ready(function () {
    const ethereumProvider = ethers.providers.getDefaultProvider('ropsten');
    const votingContractAddress = "0xe4ab691323598e36e8958730bd752784fcbfa9ab";
    const votingContractABI = [
        {
            "constant": false,
            "inputs": [
                {
                    "name": "name",
                    "type": "string"
                }
            ],
            "name": "addCandidate",
            "outputs": [],
            "payable": false,
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "constant": false,
            "inputs": [
                {
                    "name": "index",
                    "type": "uint32"
                }
            ],
            "name": "vote",
            "outputs": [],
            "payable": false,
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "candidatesCount",
            "outputs": [
                {
                    "name": "",
                    "type": "uint32"
                }
            ],
            "payable": false,
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [
                {
                    "name": "index",
                    "type": "uint32"
                }
            ],
            "name": "getCandidate",
            "outputs": [
                {
                    "name": "",
                    "type": "string"
                }
            ],
            "payable": false,
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [
                {
                    "name": "index",
                    "type": "uint32"
                }
            ],
            "name": "getVotes",
            "outputs": [
                {
                    "name": "",
                    "type": "uint32"
                }
            ],
            "payable": false,
            "stateMutability": "view",
            "type": "function"
        }
    ];
    const votingContract = new ethers.Contract(votingContractAddress, votingContractABI, ethereumProvider);

    showView("viewHome");

    $('#linkHome').click(function () {
        showView("viewHome");
    });

    $('#linkLogin').click(function () {
        showView("viewLogin");
    });

    $('#linkRegister').click(function () {
        showView("viewRegister");
    });

    $('#linkLogout').click(logout);

    $('#buttonLogin').click(login);
    $('#buttonRegister').click(register);

    function showView(viewName) {
        // Hide all views and show the selected view only
        $('main > section').hide();
        $('#' + viewName).show();
        const loggedIn = sessionStorage.jsonWallet;
        if (loggedIn) {
            $('.show-after-login').show();
            $('.hide-after-login').hide();
        } else {
            $('.show-after-login').hide();
            $('.hide-after-login').show();
        }
        if (viewName === 'viewHome')
            loadVotingResults();
    }

    // Attach AJAX "loading" event listener
    $(document).on({
        ajaxStart: function() { $("#ajaxLoadingBox").fadeIn(200) },
        ajaxStop: function() { $("#ajaxLoadingBox").fadeOut(200) }
    });

    function showInfo(message) {
        $('#infoBox>p').html(message);
        $('#infoBox').show();
        $('#infoBox>header').click(function () {
            $('#infoBox').hide();
        });
    }

    function showError(errorMsg, err) {
        let msgDetails = "";
        if (err && err.responseJSON)
            msgDetails = err.responseJSON.errorMsg;
        $('#errorBox>p').html('Error: ' + errorMsg + msgDetails);
        $('#errorBox').show();
        $('#errorBox>header').click(function () {
            $('#errorBox').hide();
        });
    }

    function showProgressBox(percent) {
        let msg = "Wallet encryption / decryption ... " +
            Math.round(percent * 100) + "% complete";
        $('#progressBox').html(msg).show(100);
    }

    function hideProgressProgress() {
        $('#progressBox').hide(100);
    }

    async function login() {
        let username = $('#usernameLogin').val();
        let password = $('#passwordLogin').val();
        let backendPassword = CryptoJS.HmacSHA256(username, password).toString();
        let result;

        try {
            result = await $.ajax({
                type: 'POST',
                url: '/login',
                data: JSON.stringify({username, password: backendPassword}),
                contentType: 'application/json'
            });
        } catch (err) {
            showError('Cannot login: ' + err);
            return;
        }

        sessionStorage['username'] = username;
        sessionStorage['jsonWallet'] = result.jsonWallet;
        showView('viewHome');
        showInfo(`User ${username} logged-in successfully!`);
    }

    async function register() {
        let username = $('#usernameRegister').val();
        let walletPassword = $('#passwordRegister').val();

        let wallet;
        let jsonWallet;

        try {
            wallet = ethers.Wallet.createRandom(username, walletPassword);
            jsonWallet = await wallet.encrypt(walletPassword, {}, showProgressBox);
        } catch (err) {
            showError("Cannot register user: " + err);
            return;
        } finally {
            hideProgressProgress();
        }

        let backendPassword = CryptoJS.HmacSHA256(username, walletPassword).toString();

        let result = await $.ajax({
            type: 'POST',
            url: '/register',
            data: JSON.stringify({username, password: backendPassword, jsonWallet}),
            contentType: 'application/json'
        });

        showView("viewHome");
        showInfo(`User ${username} registered successfully! Please save your mnemonics: <b>${wallet.mnemonic}</b>`);
    }

    async function loadVotingResults() {
        try {
            let candidates = [];
            let candidatesCount = await votingContract.candidatesCount();
            for (let index = 0; index < candidatesCount; index++) {
                let candidate = await votingContract.getCandidate(index);
                let votes = await votingContract.getVotes(index);
                candidates.push({candidate, votes});                
            }

            let votingResultsUI = $('#votingResults').empty();
            for (let index = 0; index < candidatesCount; index++) {
                let candidate = candidates[index];
                let li = $('<li>').html(`${candidate.candidate} -> ${candidate.votes} votes`);
                if (sessionStorage['username']) {
                    let button = $(`<input type="button" value="VOTE" />`);
                    button.click(function() {
                        vote(index, candidate.candidate);
                    });
                    li.append(button);
                }
                li.appendTo(votingResultsUI);
            }
        } catch (err) {
            showError(err);
        }
    }

    async function vote(candidateIndex, candidateName) {
        try {
            let jsonWallet = sessionStorage['jsonWallet'];
            let walletPassword = prompt("Enter your wallet password");
            let wallet = await ethers.Wallet.fromEncryptedWallet(jsonWallet, walletPassword, showProgressBox);
            let privateKey = wallet.privateKey;
            console.log(privateKey);
            const votingContract  = new ethers.Contract(votingContractAddress, votingContractABI, new ethers.Wallet(privateKey, ethereumProvider));

            let votingResult  = await votingContract.vote(candidateIndex);
            let tranHash = votingResult.hash;
            showInfo(`Voted successfully for <b>${candidateName}</b>! See the transaction: <a href="https://ropsten.etherscan.io/tx/${tranHash}" target="_blank">${tranHash}</a>`);
        } catch (err) {
            showError(err);
        } finally {
            hideProgressProgress();
        }
    }

    function logout() {
        sessionStorage = {};
        showView("viewHome");
    }

});


