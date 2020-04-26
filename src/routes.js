const express = require('express');
const router = express.Router();
const repository = require('./repository')

function authorizedRequest(req, res, next) {
  const unlogged_routes = ['/sign-in', '/sign-up', '/health'];
  const require_sign_in = unlogged_routes.indexOf(req.path) == -1;
  const did_not_signed = req.session.email == null;

  if (require_sign_in && did_not_signed) {
    console.log('Unauthorized');
    return res.status(401).end();
  };

  console.log('Authorized');
  next();
}

router.use(authorizedRequest);

router.get('/health', (req, res) => {
  return res.status(200).send("I'm fine, thanks for asking!");
});

router.post('/sign-up', (req, res) => {
  const body = req.body;
  let errors = [];

  const addError = (field, message) => {
    errors.push({ field: field, error_message: message });
  }

  const name = body.name;
  if (!name) {
    addError('name', 'name required');
  }

  const email = body.email;
  if (!email) {
    addError('email', 'email required');
  }

  const password = body.password;
  if (!password) {
    addError('password', 'password required');
  }

  if (errors.length > 0) {
    return res.status(400).send({ errors: errors });
  }

  repository.getUserByEmail(email, (err, user) => {
    if (err) {
      console.log(err);
      return res.status(500).end();
    }

    if (user) {
      addError('email', 'already in use');
      return res.status(400).send({ errors: errors });
    } else {
      repository.saveUser(name, email, password, (err, result) => {
        if (err || !result) {
          res.status(500).end();
        } else {
          req.session.email = email;
          res.status(200).end();
        }
      });
    }
  });
});

router.post('/sign-in', (req, res) => {
  const body = req.body;
  const email = body.email_address;
  const password = body.password;

  if (!email || !password) {
    return res.status(400).send({
      error_message: 'Email and password required'
    });
  }

  repository.getUserByEmailAndPassword(email, password, (err, user) => {
    if (err) {
      console.log(err);
      return res.status(500).end();
    }

    if (!user) {
      return res.status(400).send({
        error_message: 'Email or password incorreclty'
      });
    }

    req.session.email = email;
    return res.status(200).send(user);
  });
});

router.post('/sign-out', (req, res) => {
  req.session.destroy();
  res.status(200).end('done');
});

router.get('/user', (req, res) => {
  const email = req.session.email;
  const user = repository.getUserByEmail(email, (err, user) => {
    if (!user) return res.status(404).end();
    console.log(user);
    res.status(200).send({
      name: user.name,
      email: user.email
    });
  });
});

// TODO use user slug to retrive their punches and save them as well

router.post('/punch', (req, res) => {
  const body = req.body;

  const user_slug = body.user_slug;
  const time = body.time;
  const type = body.type;

  repository.savePunch(user_slug, time, type, (err, result) => {
    if (err) {
      return res.status(500).end();
    }
    res.status(201).end('done');
  });
});

router.get('/user/:user_slug/punches', (req, res) => {
  const body = req.body;

  const time = body.time;
  const user_slug = req.params.user_slug;

  const respond_request = (err, result) => {
    if (err) {
      return res.status(500).end();
    }

    let status = result.length == 0 ? 404 : 200;
    res.status(status).send(result)
  };

  if(time) {
    repository.userPunches(user_slug, time, respond_request);
  } else {
    repository.allUserPunches(user_slug, respond_request);
  }
});

module.exports = router;